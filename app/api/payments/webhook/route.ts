import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getRequestId, scheduleAudit, scheduleWebhookEnrichment } from "@/lib/admin/observability";
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

function webhookEventKey(gatewayId: string, notification: WebhookNotification): string {
  return createHash("sha256")
    .update(`${gatewayId}|${notification.eventId}`)
    .digest("hex");
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = getRequestId(request);
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BODY_BYTES) return json({ error: "Requisição muito grande." }, 413);

  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BODY_BYTES) return json({ error: "Requisição muito grande." }, 413);
    const signature = request.headers.get("stripe-signature")?.trim() ?? null;
    if (!signature || signature.length > 2_048) {
      throw new InvalidWebhookRequestError("Cabeçalho Stripe-Signature ausente ou inválido.");
    }
    const gateway = getPaymentGateway();
    const notification = await gateway.parseWebhook({
      rawBody,
      signatureHeader: signature,
    });
    if (!notification) {
      scheduleAudit({ level: "info", event: "payment.webhook_ignored", actorType: "gateway", entityType: "webhook", entityId: null, orderId: null, gatewayPaymentId: null, status: "ignored", requestId, source: "stripe.webhook", latencyMs: Date.now() - startedAt });
      return json({ received: true }, 200);
    }

    const orderStore = getOrderStore();
    const order = await orderStore.getByExternalReference(notification.externalReference);
    if (!order) {
      logger.warn("payment.webhook_order_not_found", { gatewayPaymentId: notification.gatewayPaymentId });
      scheduleAudit({ level: "warn", event: "payment.webhook_order_not_found", actorType: "gateway", entityType: "webhook", entityId: notification.eventId, orderId: null, gatewayPaymentId: notification.gatewayPaymentId, status: "ignored", requestId, source: "stripe.webhook", latencyMs: Date.now() - startedAt, metadata: { eventType: notification.eventType } });
      return json({ received: true }, 200);
    }
    if (!paymentMatchesOrder(order, notification)) {
      logger.error("payment.webhook_mismatch", { orderId: order.externalReference, gatewayPaymentId: notification.gatewayPaymentId });
      scheduleAudit({ level: "error", event: "payment.webhook_mismatch", actorType: "gateway", entityType: "payment_order", entityId: order.externalReference, orderId: order.externalReference, gatewayPaymentId: notification.gatewayPaymentId, status: "rejected", requestId, source: "stripe.webhook", latencyMs: Date.now() - startedAt, metadata: { eventType: notification.eventType } });
      return json({ error: "Pagamento não corresponde ao pedido." }, 422);
    }

    const eventKey = webhookEventKey(gateway.id, notification);
    const result = await reconcilePayment(orderStore, order, notification, eventKey);
    if (!result.order) {
      scheduleAudit({ level: "error", event: "payment.webhook_reconciliation_conflict", actorType: "gateway", entityType: "payment_order", entityId: order.externalReference, orderId: order.externalReference, gatewayPaymentId: notification.gatewayPaymentId, status: "conflict", requestId, source: "stripe.webhook", latencyMs: Date.now() - startedAt, metadata: { eventType: notification.eventType } });
      return json({ error: "Não foi possível reconciliar o pagamento." }, 409);
    }

    logger.info("payment.webhook_processed", {
      orderId: result.order.externalReference,
      gatewayPaymentId: notification.gatewayPaymentId,
      status: result.order.status,
      duplicate: result.duplicate,
      access: result.order.accessStatus,
    });
    const latencyMs = Date.now() - startedAt;
    const payload = {
      eventId: notification.eventId,
      eventType: notification.eventType,
      orderId: result.order.externalReference,
      status: result.order.status,
      amount: result.order.amount,
      currency: result.order.currency,
      method: result.order.method,
      duplicate: result.duplicate,
      accessStatus: result.order.accessStatus,
    };
    scheduleWebhookEnrichment({ eventKey, eventId: notification.eventId, eventType: notification.eventType, result: result.duplicate ? "duplicate" : "processed", latencyMs, payload });
    scheduleAudit({ level: "info", event: "payment.webhook_processed", actorType: "gateway", entityType: "payment_order", entityId: result.order.externalReference, orderId: result.order.externalReference, gatewayPaymentId: notification.gatewayPaymentId, status: result.order.status, requestId, source: "stripe.webhook", latencyMs, metadata: { eventType: notification.eventType, duplicate: result.duplicate } });
    return json({ received: true }, 200);
  } catch (error) {
    if (error instanceof InvalidWebhookRequestError) {
      logger.warn("payment.webhook_rejected");
      scheduleAudit({ level: "warn", event: "payment.webhook_rejected", actorType: "gateway", entityType: "webhook", entityId: null, orderId: null, gatewayPaymentId: null, status: "rejected", requestId, source: "stripe.webhook", latencyMs: Date.now() - startedAt });
      return json({ error: "Assinatura inválida." }, 401);
    }
    if (error instanceof OrderStoreUnavailableError) {
      logger.error("payment.webhook_store_unavailable");
      scheduleAudit({ level: "error", event: "payment.webhook_store_unavailable", actorType: "system", entityType: "webhook", entityId: null, orderId: null, gatewayPaymentId: null, status: "failed", requestId, source: "stripe.webhook", latencyMs: Date.now() - startedAt });
      return json({ error: "Persistência temporariamente indisponível." }, 503, { "Retry-After": "10" });
    }
    if (error instanceof PaymentGatewayError) {
      logger.warn("payment.webhook_gateway_unavailable");
      scheduleAudit({ level: "warn", event: "payment.webhook_gateway_unavailable", actorType: "gateway", entityType: "webhook", entityId: null, orderId: null, gatewayPaymentId: null, status: "failed", requestId, source: "stripe.webhook", latencyMs: Date.now() - startedAt });
      return json({ error: "Gateway temporariamente indisponível." }, 503, { "Retry-After": "10" });
    }
    logger.error("payment.webhook_failed");
    scheduleAudit({ level: "error", event: "payment.webhook_failed", actorType: "system", entityType: "webhook", entityId: null, orderId: null, gatewayPaymentId: null, status: "failed", requestId, source: "stripe.webhook", latencyMs: Date.now() - startedAt });
    return json({ error: "Não foi possível processar a notificação." }, 500);
  }
}
