import type { CreatePaymentInput, PaymentResult, WebhookNotification } from "./types";

export type WebhookVerificationInput = {
  /** Corpo bruto: necessário para a validação criptográfica da Stripe. */
  rawBody: string;
  /** Conteúdo integral do cabeçalho Stripe-Signature. */
  signatureHeader: string | null;
};

export interface PaymentGateway {
  readonly id: string;
  createPayment(input: CreatePaymentInput): Promise<PaymentResult>;
  getPayment(gatewayPaymentId: string): Promise<PaymentResult>;
  parseWebhook(input: WebhookVerificationInput): Promise<WebhookNotification | null>;
}

export class PaymentGatewayError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "PaymentGatewayError";
  }
}

export class InvalidWebhookRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidWebhookRequestError";
  }
}
