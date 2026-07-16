/**
 * Tipos de domínio da camada de pagamentos, independentes do SDK do gateway.
 */

export type PaymentMethodType = "pix" | "card" | "stripe_checkout";

export type PaymentStatus =
  | "pending"
  | "in_process"
  | "approved"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back";

export type DeliveryDetails =
  | { status: "pending" }
  | { status: "ready"; downloadUrl: string }
  | { status: "unavailable" }
  | { status: "revoked" };

export type Payer = {
  email: string;
  firstName: string;
  lastName: string;
};

export type CreatePaymentInput = {
  productSlug: string;
  amount: number;
  currency: "BRL";
  payer: Payer;
  /** Identificador único gerado pela aplicação para reconciliar o pedido. */
  externalReference: string;
  method: "stripe_checkout";
  successUrl: string;
  cancelUrl: string;
};

export type PaymentResult = {
  gatewayPaymentId: string;
  status: PaymentStatus;
  statusDetail?: string;
  method: PaymentMethodType;
  externalReference: string;
  amount: number;
  currency: string;
  payerEmail?: string;
  /** URL temporária da página de pagamento hospedada pelo gateway. */
  checkoutUrl?: string;
};

/** Notificação normalizada após validação e consulta autoritativa ao gateway. */
export type WebhookNotification = PaymentResult & {
  /** Identificador imutável do evento no gateway, usado para idempotência. */
  eventId: string;
};
