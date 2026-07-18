import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import { getRequestId } from "@/lib/admin/observability";
import { reprocessOrder, ReprocessOrderError } from "@/lib/admin/reprocess";
import { isAllowedOrigin } from "@/lib/server/origin";

export const runtime = "nodejs";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401, headers });
  if (!isAllowedOrigin(request)) return NextResponse.json({ error: "Origem não autorizada." }, { status: 403, headers });
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: "Pedido inválido." }, { status: 400, headers });
  try {
    const order = await reprocessOrder(id, getRequestId(request), session.emailHash);
    return NextResponse.json({ orderId: order.externalReference, status: order.status, accessStatus: order.accessStatus }, { headers });
  } catch (error) {
    if (error instanceof ReprocessOrderError) return NextResponse.json({ error: error.message }, { status: error.message === "Pedido não encontrado." ? 404 : 409, headers });
    return NextResponse.json({ error: "Não foi possível reprocessar o pedido." }, { status: 503, headers });
  }
}
