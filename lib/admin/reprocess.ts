import "server-only";
import { ensureCustomerAccount } from "@/lib/account/session";
import { getPaymentGateway } from "@/lib/payments/gateway";
import { getOrderStore } from "@/lib/payments/orderStore";
import { reconcilePayment } from "@/lib/payments/reconciliation";
import { getAdminStore } from "./store";

export class ReprocessOrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReprocessOrderError";
  }
}

export async function reprocessOrder(orderId: string, requestId: string, adminEmailHash: string) {
  const orderStore = getOrderStore();
  const order = await orderStore.getByExternalReference(orderId);
  if (!order) throw new ReprocessOrderError("Pedido não encontrado.");
  if (order.gateway !== "stripe" || !order.gatewayPaymentId) throw new ReprocessOrderError("Pedido sem sessão Stripe reconciliável.");

  const startedAt = Date.now();
  const payment = await getPaymentGateway().getPayment(order.gatewayPaymentId);
  const result = await reconcilePayment(orderStore, order, payment);
  if (!result.order) throw new ReprocessOrderError("Os dados retornados pelo gateway não correspondem ao pedido.");
  const account = await ensureCustomerAccount(result.order);
  await getAdminStore().recordAudit({
    level: "info",
    event: "admin.order_reprocessed",
    actorType: "admin",
    actorIdHash: adminEmailHash,
    entityType: "payment_order",
    entityId: orderId,
    orderId,
    gatewayPaymentId: result.order.gatewayPaymentId ?? null,
    status: result.order.status,
    requestId,
    source: "admin.order",
    latencyMs: Date.now() - startedAt,
    metadata: { accountPrepared: Boolean(account), accessStatus: result.order.accessStatus },
  });
  return result.order;
}
