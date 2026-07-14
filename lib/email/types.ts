export type TransactionalEmailTemplate = "purchase_approved" | "payment_pending" | "refund_processed" | "product_delivery";

export type TransactionalEmailData = {
  recipientName?: string;
  recipientEmail: string;
  productTitle: string;
  orderId: string;
  formattedAmount: string;
  accountUrl: string;
};

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export interface EmailProvider {
  send(message: EmailMessage): Promise<{ messageId: string }>;
}
