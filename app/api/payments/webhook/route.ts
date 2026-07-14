import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getPaymentGateway } from "@/lib/payments/gateway";
import { InvalidWebhookRequestError, PaymentGatewayError } from "@/lib/payments/interfaces";
import { getOrderStore, OrderStoreUnavailableError } from "@/lib/payments/orderStore";
import { paymentMatchesOrder, reconcilePayment } from "@/lib/payments/reconciliation";
import type { WebhookNotification } from "@/lib/payments/types";
import { logger } from "@/lib/server/logger";

export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };
const MAX_WEBHOOK_BODY_BYTES = 65_536;

function json(body: object, status: number, extraHeaders?: Record<string, string>) {
  return NextResponse.json(body, { status, headers: { ...NO_STORE_HEADERS, ...extraHeaders } });
}

function webhookEventKey(gatewayId: string, requestId: string, notification: WebhookNotification): string {
  return createHash("sha256")
    .update(`${gatewayId}|${requestId}|${notification.gatewayPaymentId}`)
    .digest("hex");
}

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BODY_BYTES) return json({ error: "Requisição muito grande." }, 413);

  const searchParams = new URL(request.url).searchParams;
  const requestId = request.headers.get("x-request-id")?.trim();
  const signature = request.headers.get("x-signature")?.trim();

  try {
    if (!requestId || requestId.length > 256 || !signature || signature.length > 512) {
      throw new InvalidWebhookRequestError("Cabeçalhos obrigatórios ausentes ou inválidos.");
    }
    const gateway = getPaymentGateway();
    const notification = await gateway.parseWebhook({
      signatureHeader: signature,
      requestIdHeader: requestId,
      searchParams,
    });
    if (!notification) return json({ received: true }, 200);

    const orderStore = getOrderStore();
    const order = await orderStore.getByExternalReference(notification.externalReference);
    if (!order) {
      logger.warn("payment.webhook_order_not_found", { gatewayPaymentId: notification.gatewayPaymentId });
      return json({ received: true }, 200);
    }
    if (!paymentMatchesOrder(order, notification)) {
      logger.error("payment.webhook_mismatch", { orderId: order.externalReference, gatewayPaymentId: notification.gatewayPaymentId });
      return json({ error: "Pagamento não corresponde ao pedido." }, 422);
    }

    const eventKey = webhookEventKey(gateway.id, requestId, notification);
    const result = await reconcilePayment(orderStore, order, notification, eventKey);
    if (!result.order) return json({ error: "Não foi possível reconciliar o pagamento." }, 409);

    logger.info("payment.webhook_processed", {
      orderId: result.order.externalReference,
      gatewayPaymentId: notification.gatewayPaymentId,
      status: result.order.status,
      duplicate: result.duplicate,
      access: result.order.accessStatus,
    });
    return json({ received: true }, 200);
  } catch (error) {
    if (error instanceof InvalidWebhookRequestError) {
      logger.warn("payment.webhook_rejected");
      return json({ error: "Assinatura inválida." }, 401);
    }
    if (error instanceof OrderStoreUnavailableError) {
      logger.error("payment.webhook_store_unavailable");
      return json({ error: "Persistência temporariamente indisponível." }, 503, { "Retry-After": "10" });
    }
    if (error instanceof PaymentGatewayError) {
      logger.warn("payment.webhook_gateway_unavailable");
      return json({ error: "Gateway temporariamente indisponível." }, 503, { "Retry-After": "10" });
    }
    logger.error("payment.webhook_failed");
    return json({ error: "Não foi possível processar a notificação." }, 500);
  }
}
