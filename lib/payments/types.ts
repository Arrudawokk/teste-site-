/**
 * Tipos de domínio da camada de pagamentos.
 *
 * Nenhum tipo deste arquivo depende do SDK do Mercado Pago (ou de qualquer
 * outro gateway). É isso que permite trocar de gateway no futuro (Stripe,
 * Asaas, etc.) sem alterar o restante da aplicação.
 */

export type PaymentMethodType = "pix" | "card";

/**
 * Status normalizado do pagamento, independente do gateway utilizado.
 */
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
  /** CPF apenas com dígitos. */
  documentNumber: string;
};

export type BasePaymentInput = {
  productSlug: string;
  amount: number;
  currency: "BRL";
  payer: Payer;
  /** Identificador único gerado pela aplicação para reconciliar o pedido. */
  externalReference: string;
  notificationUrl: string;
};

export type CreatePixPaymentInput = BasePaymentInput & {
  method: "pix";
};

export type CreateCardPaymentInput = BasePaymentInput & {
  method: "card";
  /** Token de cartão gerado no navegador (nunca trafega PAN/CVV pelo backend). */
  cardToken: string;
  paymentMethodId: string;
  installments: number;
};

export type CreatePaymentInput = CreatePixPaymentInput | CreateCardPaymentInput;

export type PixPaymentDetails = {
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl?: string;
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
  pix?: PixPaymentDetails;
};

/**
 * Notificação normalizada de webhook, já validada e resolvida contra o
 * gateway (nunca derivada apenas do payload recebido).
 */
export type WebhookNotification = {
  gatewayPaymentId: string;
  status: PaymentStatus;
  statusDetail?: string;
  externalReference: string;
  method: PaymentMethodType;
  amount: number;
  currency: string;
  payerEmail?: string;
};
