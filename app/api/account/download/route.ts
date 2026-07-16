import { NextResponse } from "next/server";
import { getAuthorizedOrder } from "@/lib/account/data";
import { getProductBySlug } from "@/lib/catalog";
import { getDeliverySource } from "@/lib/payments/delivery";
import { AccountStoreUnavailableError } from "@/lib/account/store";
import { OrderStoreUnavailableError } from "@/lib/payments/orderStore";
import {
  createPrivateAssetDownloadUrl,
  PrivateAssetNotFoundError,
  PrivateAssetStoreUnavailableError,
} from "@/lib/storage/privateAssets";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEADERS = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };

function json(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: HEADERS });
}

export async function GET(request: Request) {
  const orderId = new URL(request.url).searchParams.get("orderId")?.trim();
  if (!orderId || !UUID_PATTERN.test(orderId)) return json("Pedido inválido.", 400);
  try {
    const order = await getAuthorizedOrder(orderId);
    if (!order) return json("Você não tem acesso a este produto.", 403);
    const product = getProductBySlug(order.productSlug);
    const asset = product ? getDeliverySource(product) : null;
    if (!asset) return json("Armazenamento privado não configurado.", 503);
    const downloadUrl = await createPrivateAssetDownloadUrl(asset);
    return new Response(null, {
      status: 307,
      headers: { ...HEADERS, Location: downloadUrl.toString(), "Referrer-Policy": "no-referrer" },
    });
  } catch (error) {
    if (error instanceof PrivateAssetNotFoundError) return json("Arquivo não encontrado.", 404);
    if (error instanceof PrivateAssetStoreUnavailableError) return json("Arquivo temporariamente indisponível.", 503);
    if (error instanceof AccountStoreUnavailableError || error instanceof OrderStoreUnavailableError) return json("Entrega temporariamente indisponível.", 503);
    return json("Não foi possível entregar o arquivo.", 502);
  }
}
