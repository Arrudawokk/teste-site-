import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getProductBySlug } from "@/lib/catalog";
import { getDeliveryDetails } from "@/lib/payments/delivery";
import { getPaymentGateway } from "@/lib/payments/gateway";
import { PaymentGatewayError } from "@/lib/payments/interfaces";
import { getOrderStore, OrderStoreUnavailableError, type OrderRecord } from "@/lib/payments/orderStore";
import { reconcilePayment } from "@/lib/payments/reconciliation";
import type { CreatePaymentInput, PaymentResult } from "@/lib/payments/types";
import { isValidCpf, isValidEmail, onlyDigits, splitFullName } from "@/lib/payments/utils";
import { logger } from "@/lib/server/logger";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 16_384;
const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CreatePaymentBody = {
  productSlug?: string;
  method?: "pix" | "card";
  payer?: { name?: string; email?: string; document?: string };
  card?: { token?: string; paymentMethodId?: string; installments?: number };
};

function json(body: object, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

function badRequest(message: string) {
  return json({ error: message }, 400);
}

function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";

  const allowedOrigins = new Set([new URL(request.url).origin]);
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredSiteUrl) {
    try {
      allowedOrigins.add(new URL(configuredSiteUrl).origin);
    } catch {
      return false;
    }
  }
  return allowedOrigins.has(origin);
}

function getNotificationUrl(): string | null {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configuredSiteUrl) return null;

  try {
    const url = new URL(configuredSiteUrl);
    const localDevelopment = process.env.NODE_ENV === "development" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.protocol !== "https:" && !localDevelopment) return null;
    return new URL("/api/payments/webhook", url).toString();
  } catch {
    return null;
  }
}

function isSameOrder(order: OrderRecord, productSlug: string, method: "pix" | "card", email: string): boolean {
  return order.productSlug === productSlug && order.method === method && order.payerEmail.toLowerCase() === email.toLowerCase();
}

function paymentResponse(result: PaymentResult, order: OrderRecord, status = 201) {
  return json(
    {
      orderId: order.externalReference,
      status: order.status,
      pix: result.pix,
      delivery: getDeliveryDetails(order),
      purchaseEventId: order.status === "approved" ? order.externalReference : undefined,
    },
    status,
  );
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) return json({ error: "Origem da requisição não autorizada." }, 403);

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) return json({ error: "Requisição muito grande." }, 413);

  let body: CreatePaymentBody;
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) return json({ error: "Requisição muito grande." }, 413);
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return badRequest("Corpo da requisição inválido.");
    body = parsed as CreatePaymentBody;
  } catch {
    return badRequest("Corpo da requisição inválido.");
  }

  const productSlug = body.productSlug;
  const product = productSlug ? getProductBySlug(productSlug) : undefined;
  if (!product) return badRequest("Produto não encontrado no catálogo.");
  if (body.method !== "pix" && body.method !== "card") return badRequest("Forma de pagamento inválida.");

  const name = body.payer?.name?.trim();
  const email = body.payer?.email?.trim().toLowerCase();
  const document = body.payer?.document ? onlyDigits(body.payer.document) : "";
  if (!name || name.length < 2 || name.length > 120) return badRequest("Nome inválido.");
  if (!email || email.length > 254 || !isValidEmail(email)) return badRequest("E-mail inválido.");
  if (!isValidCpf(document)) return badRequest("CPF inválido.");

  const clientIdempotencyKey = request.headers.get("x-idempotency-key")?.trim();
  if (clientIdempotencyKey && !UUID_V4_PATTERN.test(clientIdempotencyKey)) return badRequest("Chave de idempotência inválida.");

  const notificationUrl = getNotificationUrl();
  if (!notificationUrl) return json({ error: "Checkout temporariamente indisponível." }, 503);

  const { firstName, lastName } = splitFullName(name);
  const externalReference = clientIdempotencyKey ?? randomUUID();
  const basePayload = {
    productSlug: product.slug,
    amount: product.price,
    currency: product.currency,
    payer: { email, firstName, lastName, documentNumber: document },
    externalReference,
    notificationUrl,
  };

  let input: CreatePaymentInput;
  if (body.method === "pix") {
    input = { ...basePayload, method: "pix" };
  } else {
    const cardToken = body.card?.token?.trim();
    const paymentMethodId = body.card?.paymentMethodId?.trim();
    const installments = body.card?.installments ?? 1;
    if (!cardToken || cardToken.length > 256 || !paymentMethodId || !/^[a-z0-9_-]{1,50}$/i.test(paymentMethodId) || installments !== 1) {
      return badRequest("Dados do cartão inválidos.");
    }
    input = { ...basePayload, method: "card", cardToken, paymentMethodId, installments };
  }

  try {
    const orderStore = getOrderStore();
    const now = new Date().toISOString();
    const initialOrder: OrderRecord = {
      externalReference,
      productSlug: product.slug,
      amount: product.price,
      currency: product.currency,
      payerEmail: email,
      method: body.method,
      status: "pending",
      accessStatus: "pending",
      createdAt: now,
      updatedAt: now,
    };
    const created = await orderStore.create(initialOrder);

    if (!created) {
      const existing = await orderStore.getByExternalReference(externalReference);
      if (!existing || !isSameOrder(existing, product.slug, body.method, email)) {
        return json({ error: "A chave de idempotência já foi utilizada em outro pedido." }, 409);
      }
      if (existing.gatewayPaymentId) {
        const existingPayment = await getPaymentGateway().getPayment(existing.gatewayPaymentId);
        const reconciled = await reconcilePayment(orderStore, existing, existingPayment);
        if (!reconciled.order) return json({ error: "O pagamento existente não corresponde ao pedido." }, 409);
        return paymentResponse(existingPayment, reconciled.order, 200);
      }
    }

    const result = await getPaymentGateway().createPayment(input);
    const currentOrder = (await orderStore.getByExternalReference(externalReference)) ?? initialOrder;
    const reconciled = await reconcilePayment(orderStore, currentOrder, result);
    if (!reconciled.order) return json({ error: "Não foi possível reconciliar o pagamento com o pedido." }, 409);
    logger.info("payment.created", { orderId: externalReference, gatewayPaymentId: result.gatewayPaymentId, status: reconciled.order.status });
    return paymentResponse(result, reconciled.order);
  } catch (error) {
    if (error instanceof OrderStoreUnavailableError) {
      logger.error("payment.store_unavailable", { orderId: externalReference });
      return json({ error: "Checkout temporariamente indisponível." }, 503);
    }
    if (error instanceof PaymentGatewayError) {
      logger.warn("payment.gateway_unavailable", { orderId: externalReference });
      return json({ error: "Não foi possível processar o pagamento. Tente novamente." }, 502);
    }
    logger.error("payment.create_failed", { orderId: externalReference });
    return json({ error: "Não foi possível processar o pagamento." }, 500);
  }
}
