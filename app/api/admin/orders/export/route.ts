import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import { getRequestId } from "@/lib/admin/observability";
import { formatDateTime } from "@/lib/admin/format";
import { getAdminStore } from "@/lib/admin/store";
import { getProductBySlug } from "@/lib/catalog";
import type { PaymentStatus } from "@/lib/payments/types";

export const runtime = "nodejs";
const statuses: PaymentStatus[] = ["pending", "in_process", "approved", "rejected", "cancelled", "refunded", "charged_back"];

function amount(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function csvCell(value: string | number): string {
  const text = String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

function xml(value: string | number): string {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const statusValue = params.get("status");
  const status = statuses.includes(statusValue as PaymentStatus) ? statusValue as PaymentStatus : undefined;
  const result = await getAdminStore().listOrders({ query: params.get("q") ?? undefined, status, productSlug: params.get("product") ?? undefined, email: params.get("email") ?? undefined, dateFrom: params.get("from") ?? undefined, dateTo: params.get("to") ?? undefined, minAmount: amount(params.get("min")), maxAmount: amount(params.get("max")), page: 1, pageSize: 10_000 });
  const header = ["Pedido", "Cliente", "Email", "Produto", "Valor", "Moeda", "Gateway", "Método", "Status", "Criado", "Atualizado", "Gateway Payment ID", "Downloads"];
  const rows = result.items.map((order) => [order.externalReference, order.payerName ?? "", order.payerEmail, getProductBySlug(order.productSlug)?.title ?? order.productSlug, order.amount.toFixed(2), order.currency, order.gateway, order.method, order.status, formatDateTime(order.createdAt), formatDateTime(order.updatedAt), order.gatewayPaymentId ?? "", order.downloadCount]);
  const format = params.get("format") === "xls" ? "xls" : "csv";
  const requestId = getRequestId(request);
  await getAdminStore().recordAudit({ level: "info", event: "admin.orders_exported", actorType: "admin", actorIdHash: session.emailHash, entityType: "payment_order", entityId: null, orderId: null, gatewayPaymentId: null, status: "completed", requestId, source: "admin.export", latencyMs: null, metadata: { format, records: rows.length } });

  if (format === "xls") {
    const tableRows = [header, ...rows].map((row) => `<Row>${row.map((cell) => `<Cell><Data ss:Type="${typeof cell === "number" ? "Number" : "String"}">${xml(cell)}</Data></Cell>`).join("")}</Row>`).join("");
    const body = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Pedidos"><Table>${tableRows}</Table></Worksheet></Workbook>`;
    return new Response(body, { headers: { "Content-Type": "application/vnd.ms-excel; charset=utf-8", "Content-Disposition": `attachment; filename="escalahub-pedidos-${new Date().toISOString().slice(0, 10)}.xls"`, "Cache-Control": "private, no-store" } });
  }

  const body = `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
  return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="escalahub-pedidos-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "private, no-store" } });
}
