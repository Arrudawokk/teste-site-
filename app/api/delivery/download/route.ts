import { NextResponse } from "next/server";
import { getProductBySlug } from "@/lib/catalog";
import { getDeliverySource, verifyDeliveryToken } from "@/lib/payments/delivery";
import { getOrderStore, OrderStoreUnavailableError } from "@/lib/payments/orderStore";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };

function json(body: object, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

function safeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const orderId = searchParams.get("orderId")?.trim();
  const expires = searchParams.get("expires")?.trim();
  const signature = searchParams.get("signature")?.trim();
  if (!orderId || !UUID_PATTERN.test(orderId) || !expires || !signature) return json({ error: "Link de download inválido." }, 400);

  try {
    const order = await getOrderStore().getByExternalReference(orderId);
    if (!order || !verifyDeliveryToken(order, expires, signature)) return json({ error: "Link de download inválido ou expirado." }, 403);
    if (order.status !== "approved" || order.accessStatus !== "granted") return json({ error: "Acesso ao produto indisponível." }, 403);

    const product = getProductBySlug(order.productSlug);
    const source = product ? getDeliverySource(product) : null;
    if (!source) return json({ error: "Arquivo temporariamente indisponível." }, 503);

    const upstream = await fetch(source.url, {
      cache: "no-store",
      headers: source.authorization ? { Authorization: source.authorization } : undefined,
      redirect: "error",
      signal: AbortSignal.timeout(12_000),
    });
    if (!upstream.ok || !upstream.body) return json({ error: "Arquivo temporariamente indisponível." }, 502);

    const headers = new Headers({
      ...NO_STORE_HEADERS,
      "Content-Type": source.contentType,
      "Content-Disposition": `attachment; filename="${safeFileName(source.fileName)}"; filename*=UTF-8''${encodeURIComponent(source.fileName)}`,
      "Content-Security-Policy": "sandbox",
    });
    const contentLength = upstream.headers.get("content-length");
    if (contentLength && /^\d+$/.test(contentLength)) headers.set("Content-Length", contentLength);
    return new Response(upstream.body, { status: 200, headers });
  } catch (error) {
    if (error instanceof OrderStoreUnavailableError) return json({ error: "Entrega temporariamente indisponível." }, 503);
    return json({ error: "Não foi possível entregar o arquivo." }, 502);
  }
}
