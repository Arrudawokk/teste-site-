import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { AccountStoreUnavailableError } from "@/lib/account/store";
import { issueCustomerSession } from "@/lib/account/session";
import { getProductBySlug } from "@/lib/catalog";
import { getDeliveryDetails } from "@/lib/payments/delivery";
import { getPaymentGateway } from "@/lib/payments/gateway";
import { PaymentGatewayError } from "@/lib/payments/interfaces";
import { getOrderStore, OrderStoreUnavailableError, type OrderRecord } from "@/lib/payments/orderStore";
import { reconcilePayment } from "@/lib/payments/reconciliation";
import type { CreatePaymentInput, PaymentResult } from "@/lib/payments/types";
import { isValidEmail, splitFullName } from "@/lib/payments/utils";
import { logger } from "@/lib/server/logger";
import { hasDeploymentSiteUrl, SITE_URL } from "@/lib/site";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 16_384;
const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CreatePaymentBody = {
  productSlug?: string;
  payer?: { name?: string; email?: string };
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
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  if (host) {
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const protocol = forwardedProtocol || new URL(request.url).protocol.replace(":", "");
    if (protocol === "https" || (process.env.NODE_ENV !== "production" && protocol === "http")) {
      allowedOrigins.add(`${protocol}://${host}`);
    }
  }
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

function checkoutUrls(productSlug: string, orderId: string): { successUrl: string; cancelUrl: string } | null {
  if (!hasDeploymentSiteUrl) return null;
  try {
    const successUrl = new URL("/checkout", SITE_URL);
    successUrl.searchParams.set("product", productSlug);
    successUrl.searchParams.set("orderId", orderId);
    successUrl.searchParams.set("stripe", "success");
    // A Stripe substitui este marcador literal depois de concluir a sessão.
    successUrl.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");

    const cancelUrl = new URL("/checkout", SITE_URL);
    cancelUrl.searchParams.set("product", productSlug);
    cancelUrl.searchParams.set("orderId", orderId);
    cancelUrl.searchParams.set("stripe", "cancelled");

    return {
      successUrl: successUrl.toString().replace("%7BCHECKOUT_SESSION_ID%7D", "{CHECKOUT_SESSION_ID}"),
      cancelUrl: cancelUrl.toString(),
    };
  } catch {
    return null;
  }
}

function isSameOrder(order: OrderRecord, productSlug: string, email: string): boolean {
  return (
    order.productSlug === productSlug &&
    order.gateway === "stripe" &&
    order.method === "stripe_checkout" &&
    order.payerEmail.toLowerCase() === email.toLowerCase()
  );
}

async function paymentResponse(result: PaymentResult, order: OrderRecord, status = 201) {
  if (order.status === "approved" && order.accessStatus === "granted") {
    try {
      await issueCustomerSession(order);
    } catch (error) {
      if (!(error instanceof AccountStoreUnavailableError)) throw error;
      logger.warn("account.session_deferred", { orderId: order.externalReference });
    }
  }
  return json(
    {
      orderId: order.externalReference,
      status: order.status,
      checkoutUrl: result.checkoutUrl,
      delivery: getDeliveryDetails(order),
      purchaseEventId: order.status === "approved" ? order.externalReference : undefined,
      accountUrl: order.status === "approved" ? "/account" : undefined,
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

  const name = body.payer?.name?.trim();
  const email = body.payer?.email?.trim().toLowerCase();
  if (!name || name.length < 2 || name.length > 120) return badRequest("Nome inválido.");
  if (!email || email.length > 254 || !isValidEmail(email)) return badRequest("E-mail inválido.");

  const clientIdempotencyKey = request.headers.get("x-idempotency-key")?.trim();
  if (clientIdempotencyKey && !UUID_V4_PATTERN.test(clientIdempotencyKey)) return badRequest("Chave de idempotência inválida.");

  const externalReference = clientIdempotencyKey ?? randomUUID();
  const urls = checkoutUrls(product.slug, externalReference);
  if (!urls) return json({ error: "Checkout temporariamente indisponível." }, 503);

  const { firstName, lastName } = splitFullName(name);
  const input: CreatePaymentInput = {
    productSlug: product.slug,
    amount: product.price,
    currency: product.currency,
    payer: { email, firstName, lastName },
    externalReference,
    method: "stripe_checkout",
    ...urls,
  };

  try {
    const orderStore = getOrderStore();
    const now = new Date().toISOString();
    const initialOrder: OrderRecord = {
      externalReference,
      productSlug: product.slug,
      amount: product.price,
      currency: product.currency,
      payerEmail: email,
      payerName: name,
      gateway: "stripe",
      method: "stripe_checkout",
      status: "pending",
      accessStatus: "pending",
      createdAt: now,
      updatedAt: now,
    };
    const created = await orderStore.create(initialOrder);

    if (!created) {
      const existing = await orderStore.getByExternalReference(externalReference);
      if (!existing || !isSameOrder(existing, product.slug, email)) {
        return json({ error: "A chave de idempotência já foi utilizada em outro pedido." }, 409);
      }
      if (existing.gatewayPaymentId) {
        const existingPayment = await getPaymentGateway().getPayment(existing.gatewayPaymentId);
        const reconciled = await reconcilePayment(orderStore, existing, existingPayment);
        if (!reconciled.order) return json({ error: "O pagamento existente não corresponde ao pedido." }, 409);
        return await paymentResponse(existingPayment, reconciled.order, 200);
      }
    }

    const result = await getPaymentGateway().createPayment(input);
    const currentOrder = (await orderStore.getByExternalReference(externalReference)) ?? initialOrder;
    const reconciled = await reconcilePayment(orderStore, currentOrder, result);
    if (!reconciled.order) return json({ error: "Não foi possível reconciliar o pagamento com o pedido." }, 409);
    logger.info("payment.created", { orderId: externalReference, gatewayPaymentId: result.gatewayPaymentId, status: reconciled.order.status });
    return await paymentResponse(result, reconciled.order);
  } catch (error) {
    if (error instanceof OrderStoreUnavailableError) {
      logger.error("payment.store_unavailable", { orderId: externalReference });
      return json({ error: "Checkout temporariamente indisponível." }, 503);
    }
    if (error instanceof PaymentGatewayError) {
      logger.warn("payment.gateway_unavailable", { orderId: externalReference });
      return json({ error: "Não foi possível iniciar o pagamento. Tente novamente." }, 502);
    }
    logger.error("payment.create_failed", { orderId: externalReference });
    return json({ error: "Não foi possível iniciar o pagamento." }, 500);
  }
}
