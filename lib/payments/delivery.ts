import { createHmac, timingSafeEqual } from "node:crypto";
import { getProductBySlug, type Product } from "@/lib/catalog";
import type { DeliveryDetails } from "./types";
import type { OrderRecord } from "./orderStore";

const DOWNLOAD_TOKEN_TTL_SECONDS = 15 * 60;
const MINIMUM_SECRET_LENGTH = 32;

type DeliverySource = {
  url: URL;
  authorization?: string;
  fileName: string;
  contentType: Product["delivery"]["contentType"];
};

function getDeliverySecret(): string | null {
  const secret = process.env.DELIVERY_TOKEN_SECRET?.trim();
  return secret && secret.length >= MINIMUM_SECRET_LENGTH ? secret : null;
}

function signaturePayload(orderId: string, productSlug: string, expiresAt: number): string {
  return `${orderId}.${productSlug}.${expiresAt}`;
}

function createSignature(orderId: string, productSlug: string, expiresAt: number, secret: string): string {
  return createHmac("sha256", secret).update(signaturePayload(orderId, productSlug, expiresAt)).digest("hex");
}

export function getDeliverySource(product: Product): DeliverySource | null {
  const configuredUrl = process.env[product.delivery.sourceUrlEnvironmentVariable]?.trim();
  if (!configuredUrl) return null;

  try {
    const url = new URL(configuredUrl);
    const localDevelopment = process.env.NODE_ENV === "development" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.protocol !== "https:" && !localDevelopment) return null;
    const authorizationVariable = product.delivery.sourceAuthorizationEnvironmentVariable;
    const authorization = authorizationVariable ? process.env[authorizationVariable]?.trim() : undefined;
    return {
      url,
      authorization: authorization || undefined,
      fileName: product.delivery.fileName,
      contentType: product.delivery.contentType,
    };
  } catch {
    return null;
  }
}

export function getDeliveryDetails(order: OrderRecord): DeliveryDetails {
  if (order.accessStatus === "revoked") return { status: "revoked" };
  if (order.status !== "approved" || order.accessStatus !== "granted") return { status: "pending" };

  const product = getProductBySlug(order.productSlug);
  const secret = getDeliverySecret();
  if (!product || !secret || !getDeliverySource(product)) return { status: "unavailable" };

  const expiresAt = Math.floor(Date.now() / 1000) + DOWNLOAD_TOKEN_TTL_SECONDS;
  const signature = createSignature(order.externalReference, order.productSlug, expiresAt, secret);
  const searchParams = new URLSearchParams({
    orderId: order.externalReference,
    expires: String(expiresAt),
    signature,
  });
  return { status: "ready", downloadUrl: `/api/delivery/download?${searchParams.toString()}` };
}

export function verifyDeliveryToken(order: OrderRecord, expiresAtValue: string, signature: string): boolean {
  const secret = getDeliverySecret();
  const expiresAt = Number(expiresAtValue);
  const now = Math.floor(Date.now() / 1000);
  if (!secret || !/^\d{10}$/.test(expiresAtValue) || !Number.isSafeInteger(expiresAt) || expiresAt < now || expiresAt > now + DOWNLOAD_TOKEN_TTL_SECONDS) {
    return false;
  }
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;

  const expected = Buffer.from(createSignature(order.externalReference, order.productSlug, expiresAt, secret), "hex");
  const received = Buffer.from(signature, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}
