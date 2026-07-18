import Stripe from "stripe";
import {
  InvalidWebhookRequestError,
  PaymentGatewayError,
  type PaymentGateway,
  type WebhookVerificationInput,
} from "./interfaces";
import type { CreatePaymentInput, PaymentResult, PaymentStatus, WebhookNotification } from "./types";
import { buildIdempotencyKey } from "./utils";

const STRIPE_ID_PATTERN = /^cs_(?:test_|live_)?[A-Za-z0-9]+$/;
const SIGNATURE_TOLERANCE_SECONDS = 300;

function keyMode(key: string): "test" | "live" | null {
  if (key.startsWith("sk_test_") || key.startsWith("pk_test_")) return "test";
  if (key.startsWith("sk_live_") || key.startsWith("pk_live_")) return "live";
  return null;
}

function sessionStatus(session: Stripe.Checkout.Session): PaymentStatus {
  if (session.payment_status === "paid") return "approved";
  if (session.status === "expired") return "cancelled";
  if (session.status === "complete") return "in_process";
  return "pending";
}

/** Único módulo que conhece a SDK oficial da Stripe. */
export class StripeGateway implements PaymentGateway {
  readonly id = "stripe";

  private readonly client: Stripe;
  private readonly webhookSecret: string;
  private readonly priceId: string;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    const priceId = process.env.PRICE_ID?.trim();

    if (!secretKey || !keyMode(secretKey) || !secretKey.startsWith("sk_")) {
      throw new PaymentGatewayError("STRIPE_SECRET_KEY ausente ou inválida.");
    }
    if (!publishableKey || !keyMode(publishableKey) || !publishableKey.startsWith("pk_")) {
      throw new PaymentGatewayError("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ausente ou inválida.");
    }
    if (keyMode(secretKey) !== keyMode(publishableKey)) {
      throw new PaymentGatewayError("As chaves pública e secreta da Stripe pertencem a modos diferentes.");
    }
    if (!webhookSecret?.startsWith("whsec_")) {
      throw new PaymentGatewayError("STRIPE_WEBHOOK_SECRET ausente ou inválida.");
    }
    if (!priceId?.startsWith("price_")) {
      throw new PaymentGatewayError("PRICE_ID ausente ou inválido.");
    }

    this.client = new Stripe(secretKey, {
      maxNetworkRetries: 2,
      timeout: 8_000,
      appInfo: { name: "EscalaHub", version: "1.0.0" },
    });
    this.webhookSecret = webhookSecret;
    this.priceId = priceId;
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    try {
      const price = await this.client.prices.retrieve(this.priceId);
      const expectedAmount = Math.round(input.amount * 100);
      if (
        !price.active ||
        price.type !== "one_time" ||
        price.currency.toUpperCase() !== input.currency ||
        price.unit_amount !== expectedAmount
      ) {
        throw new PaymentGatewayError("O preço configurado na Stripe não corresponde ao produto.");
      }

      const session = await this.client.checkout.sessions.create(
        {
          mode: "payment",
          locale: "pt-BR",
          client_reference_id: input.externalReference,
          customer_email: input.payer.email,
          line_items: [{ price: this.priceId, quantity: 1 }],
          payment_method_types: ["card"],
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          submit_type: "pay",
          metadata: {
            order_id: input.externalReference,
            product_slug: input.productSlug,
          },
          payment_intent_data: {
            metadata: {
              order_id: input.externalReference,
              product_slug: input.productSlug,
            },
          },
        },
        { idempotencyKey: buildIdempotencyKey(input.externalReference) },
      );

      const result = this.toPaymentResult(session);
      if (
        result.externalReference !== input.externalReference ||
        result.currency !== input.currency ||
        Math.round(result.amount * 100) !== expectedAmount ||
        result.payerEmail?.toLowerCase() !== input.payer.email.toLowerCase()
      ) {
        throw new PaymentGatewayError("A sessão criada não corresponde ao pedido enviado.");
      }
      return result;
    } catch (error) {
      console.error("===== STRIPE ERROR =====");
      console.error(error);

      if (error instanceof Stripe.errors.StripeError) {
        console.error({
          type: error.type,
          code: error.code,
          message: error.message,
          param: error.param,
          decline_code: error.decline_code,
          request_id: error.requestId,
          statusCode: error.statusCode,
          raw: error.raw,
          stack: error.stack,
        });
      }

      if (error instanceof PaymentGatewayError) throw error;
      throw new PaymentGatewayError("Falha ao criar sessão de pagamento na Stripe.", error);
    }
  }

  async getPayment(gatewayPaymentId: string): Promise<PaymentResult> {
    if (!STRIPE_ID_PATTERN.test(gatewayPaymentId)) {
      throw new PaymentGatewayError("Identificador de sessão Stripe inválido.");
    }
    try {
      const session = await this.client.checkout.sessions.retrieve(gatewayPaymentId);
      return this.toPaymentResult(session);
    } catch (error) {
      throw new PaymentGatewayError("Falha ao consultar a sessão na Stripe.", error);
    }
  }

  async cancelPayment(gatewayPaymentId: string): Promise<PaymentResult> {
    if (!STRIPE_ID_PATTERN.test(gatewayPaymentId)) {
      throw new PaymentGatewayError("Identificador de sessão Stripe inválido.");
    }

    try {
      const current = await this.client.checkout.sessions.retrieve(gatewayPaymentId);
      if (current.status !== "open") return this.toPaymentResult(current);

      try {
        return this.toPaymentResult(await this.client.checkout.sessions.expire(gatewayPaymentId));
      } catch (error) {
        if (!(error instanceof Stripe.errors.StripeInvalidRequestError)) throw error;

        const latest = await this.client.checkout.sessions.retrieve(gatewayPaymentId);
        if (latest.status === "open") throw error;
        return this.toPaymentResult(latest);
      }
    } catch (error) {
      if (error instanceof PaymentGatewayError) throw error;
      throw new PaymentGatewayError("Falha ao cancelar a sessão na Stripe.", error);
    }
  }

  async parseWebhook(input: WebhookVerificationInput): Promise<WebhookNotification | null> {
    if (!input.signatureHeader || input.signatureHeader.length > 2_048) {
      throw new InvalidWebhookRequestError("Cabeçalho Stripe-Signature ausente ou inválido.");
    }

    let event: Stripe.Event;
    try {
      event = this.client.webhooks.constructEvent(
        input.rawBody,
        input.signatureHeader,
        this.webhookSecret,
        SIGNATURE_TOLERANCE_SECONDS,
      );
    } catch {
      throw new InvalidWebhookRequestError("Assinatura Stripe inválida ou expirada.");
    }

    let result: PaymentResult | null = null;
    let statusOverride: PaymentStatus | undefined;

    try {
      switch (event.type) {
        case "checkout.session.completed":
          result = await this.getPayment(event.data.object.id);
          break;
        case "checkout.session.expired":
          result = await this.getPayment(event.data.object.id);
          statusOverride = "cancelled";
          break;
        case "payment_intent.succeeded":
          if ((await this.client.paymentIntents.retrieve(event.data.object.id)).status !== "succeeded") return null;
          result = await this.getPaymentByIntent(event.data.object.id);
          statusOverride = "approved";
          break;
        case "payment_intent.payment_failed":
          if ((await this.client.paymentIntents.retrieve(event.data.object.id)).status === "succeeded") {
            result = await this.getPaymentByIntent(event.data.object.id);
            statusOverride = "approved";
            break;
          }
          result = await this.getPaymentByIntent(event.data.object.id);
          statusOverride = result.status === "cancelled" ? "cancelled" : "in_process";
          break;
        case "charge.refunded": {
          const charge = await this.client.charges.retrieve(event.data.object.id);
          if (charge.amount_refunded < charge.amount) return null;
          result = await this.getPaymentByCharge(charge);
          statusOverride = "refunded";
          break;
        }
        case "charge.dispute.created": {
          const dispute = await this.client.disputes.retrieve(event.data.object.id);
          result = await this.getPaymentByDispute(dispute);
          statusOverride = "charged_back";
          break;
        }
        default:
          return null;
      }
    } catch (error) {
      if (error instanceof PaymentGatewayError) throw error;
      throw new PaymentGatewayError("Falha ao confirmar evento na Stripe.", error);
    }

    if (!result) return null;
    return { ...result, status: statusOverride ?? result.status, eventId: event.id, eventType: event.type };
  }

  private async getPaymentByIntent(paymentIntentId: string): Promise<PaymentResult> {
    const sessions = await this.client.checkout.sessions.list({ payment_intent: paymentIntentId, limit: 1 });
    const session = sessions.data[0];
    if (!session) throw new PaymentGatewayError("Sessão Stripe não encontrada para o pagamento.");
    return this.getPayment(session.id);
  }

  private async getPaymentByCharge(charge: Stripe.Charge): Promise<PaymentResult> {
    const intentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
    if (!intentId) throw new PaymentGatewayError("Cobrança Stripe sem PaymentIntent.");
    return this.getPaymentByIntent(intentId);
  }

  private async getPaymentByDispute(dispute: Stripe.Dispute): Promise<PaymentResult> {
    const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
    if (!chargeId) throw new PaymentGatewayError("Contestação Stripe sem cobrança.");
    const charge = await this.client.charges.retrieve(chargeId);
    return this.getPaymentByCharge(charge);
  }

  private toPaymentResult(session: Stripe.Checkout.Session): PaymentResult {
    const externalReference = session.client_reference_id ?? session.metadata?.order_id;
    const payerEmail = session.customer_details?.email ?? session.customer_email ?? undefined;
    if (!externalReference) throw new PaymentGatewayError("Sessão Stripe sem referência do pedido.");
    if (typeof session.amount_total !== "number" || !Number.isFinite(session.amount_total)) {
      throw new PaymentGatewayError("Sessão Stripe sem valor válido.");
    }
    if (!session.currency) throw new PaymentGatewayError("Sessão Stripe sem moeda.");

    return {
      gatewayPaymentId: session.id,
      status: sessionStatus(session),
      statusDetail: `${session.status ?? "unknown"}:${session.payment_status}`,
      method: "stripe_checkout",
      externalReference,
      amount: session.amount_total / 100,
      currency: session.currency.toUpperCase(),
      payerEmail,
      checkoutUrl: session.status === "open" ? (session.url ?? undefined) : undefined,
    };
  }
}
