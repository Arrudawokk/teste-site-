import type { OrderRecord, OrderStore, PaymentUpdateResult } from "./orderStore";
import type { PaymentResult, WebhookNotification } from "./types";

type AuthoritativePayment = PaymentResult | WebhookNotification;

export function paymentMatchesOrder(order: OrderRecord, payment: AuthoritativePayment): boolean {
  return (
    payment.externalReference === order.externalReference &&
    (!order.gatewayPaymentId || order.gatewayPaymentId === payment.gatewayPaymentId) &&
    payment.method === order.method &&
    payment.currency === order.currency &&
    Math.round(payment.amount * 100) === Math.round(order.amount * 100) &&
    Boolean(payment.payerEmail) &&
    payment.payerEmail?.toLowerCase() === order.payerEmail.toLowerCase()
  );
}

export async function reconcilePayment(
  orderStore: OrderStore,
  order: OrderRecord,
  payment: AuthoritativePayment,
  webhookEventKey?: string,
): Promise<PaymentUpdateResult> {
  if (!paymentMatchesOrder(order, payment)) return { order: null, duplicate: false };
  return orderStore.applyPaymentUpdate({
    externalReference: order.externalReference,
    gatewayPaymentId: payment.gatewayPaymentId,
    status: payment.status,
    webhookEventKey,
  });
}
