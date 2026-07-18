import { NextResponse } from "next/server";
import { getRequestId, scheduleDownloadAudit } from "@/lib/admin/observability";
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
  const requestId = getRequestId(request);
  const orderId = new URL(request.url).searchParams.get("orderId")?.trim();
  if (!orderId || !UUID_PATTERN.test(orderId)) return json("Pedido inválido.", 400);
  try {
    const order = await getAuthorizedOrder(orderId);
    if (!order) {
      scheduleDownloadAudit({ orderId, requestId, source: "account", result: "forbidden" });
      return json("Você não tem acesso a este produto.", 403);
    }
    const product = getProductBySlug(order.productSlug);
    const asset = product ? getDeliverySource(product) : null;
    if (!asset) {
      scheduleDownloadAudit({ orderId, requestId, source: "account", result: "unavailable" });
      return json("Armazenamento privado não configurado.", 503);
    }
    const downloadUrl = await createPrivateAssetDownloadUrl(asset);
    scheduleDownloadAudit({ orderId, requestId, source: "account", result: "authorized" });
    return new Response(null, {
      status: 307,
      headers: { ...HEADERS, Location: downloadUrl.toString(), "Referrer-Policy": "no-referrer" },
    });
  } catch (error) {
    if (error instanceof PrivateAssetNotFoundError) {
      scheduleDownloadAudit({ orderId, requestId, source: "account", result: "not_found" });
      return json("Arquivo não encontrado.", 404);
    }
    if (error instanceof PrivateAssetStoreUnavailableError) { scheduleDownloadAudit({ orderId, requestId, source: "account", result: "unavailable" }); return json("Arquivo temporariamente indisponível.", 503); }
    if (error instanceof AccountStoreUnavailableError || error instanceof OrderStoreUnavailableError) { scheduleDownloadAudit({ orderId, requestId, source: "account", result: "unavailable" }); return json("Entrega temporariamente indisponível.", 503); }
    scheduleDownloadAudit({ orderId, requestId, source: "account", result: "failed" });
    return json("Não foi possível entregar o arquivo.", 502);
  }
}
