import { NextResponse } from "next/server";
import { getDeliveryDetails } from "@/lib/payments/delivery";
import { getPaymentGateway } from "@/lib/payments/gateway";
import { PaymentGatewayError } from "@/lib/payments/interfaces";
import { getOrderStore, OrderStoreUnavailableError, type OrderRecord } from "@/lib/payments/orderStore";
import { reconcilePayment } from "@/lib/payments/reconciliation";
import { logger } from "@/lib/server/logger";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RESPONSE_OPTIONS = { headers: { "Cache-Control": "no-store, max-age=0" } };
const GATEWAY_SYNC_INTERVAL_MS = 8_000;

function response(order: OrderRecord) {
  return NextResponse.json(
    {
      status: order.status,
      delivery: getDeliveryDetails(order),
      purchaseEventId: order.status === "approved" ? order.externalReference : undefined,
    },
    RESPONSE_OPTIONS,
  );
}

export async function GET(request: Request) {
  const orderId = new URL(request.url).searchParams.get("orderId")?.trim();
  if (!orderId || !UUID_PATTERN.test(orderId)) {
    return NextResponse.json({ error: "orderId inválido." }, { status: 400, ...RESPONSE_OPTIONS });
  }

  try {
    const orderStore = getOrderStore();
    let order = await orderStore.getByExternalReference(orderId);
    if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404, ...RESPONSE_OPTIONS });

    if ((order.status === "pending" || order.status === "in_process") && order.gatewayPaymentId) {
      const shouldSync = await orderStore.claimGatewaySync(order.externalReference, GATEWAY_SYNC_INTERVAL_MS);
      if (shouldSync) {
        try {
          const payment = await getPaymentGateway().getPayment(order.gatewayPaymentId);
          const reconciled = await reconcilePayment(orderStore, order, payment);
          if (!reconciled.order) {
            logger.error("payment.status_mismatch", { orderId, gatewayPaymentId: order.gatewayPaymentId });
            return NextResponse.json({ error: "Não foi possível reconciliar o pagamento." }, { status: 409, ...RESPONSE_OPTIONS });
          }
          order = reconciled.order;
        } catch (error) {
          if (!(error instanceof PaymentGatewayError)) throw error;
          logger.warn("payment.status_sync_deferred", { orderId, gatewayPaymentId: order.gatewayPaymentId });
        }
      }
    }

    return response(order);
  } catch (error) {
    if (error instanceof OrderStoreUnavailableError) {
      logger.error("payment.status_store_unavailable", { orderId });
      return NextResponse.json({ error: "Consulta temporariamente indisponível." }, { status: 503, ...RESPONSE_OPTIONS });
    }
    logger.error("payment.status_failed", { orderId });
    return NextResponse.json({ error: "Não foi possível consultar o pedido." }, { status: 500, ...RESPONSE_OPTIONS });
  }
}
