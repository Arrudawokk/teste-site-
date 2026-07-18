import Link from "next/link";
import { FiDownload, FiEye, FiFilter, FiSearch } from "react-icons/fi";
import { AdminPageHeader, DataPanel, EmptyState, Pagination, PaymentStatusBadge } from "@/components/admin/AdminUI";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatDateTime } from "@/lib/admin/format";
import { getAdminStore } from "@/lib/admin/store";
import { getProductBySlug, getPublishedProducts } from "@/lib/catalog";
import type { PaymentStatus } from "@/lib/payments/types";

type SearchParams = { q?: string; status?: string; product?: string; email?: string; from?: string; to?: string; min?: string; max?: string; page?: string };
const statuses: PaymentStatus[] = ["pending", "in_process", "approved", "rejected", "cancelled", "refunded", "charged_back"];

function positiveNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const status = statuses.includes(params.status as PaymentStatus) ? params.status as PaymentStatus : undefined;
  const result = await getAdminStore().listOrders({ query: params.q, status, productSlug: params.product, email: params.email, dateFrom: params.from, dateTo: params.to, minAmount: positiveNumber(params.min), maxAmount: positiveNumber(params.max), page, pageSize: 20 });
  const exportParams = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])));
  return (
    <>
      <AdminPageHeader eyebrow="Operação financeira" title="Pedidos" description={`${result.total} pedidos encontrados. Consulte status, cliente, gateway e histórico sem acessar diretamente o banco.`} actions={<><Button asChild variant="outline" size="sm"><a href={`/api/admin/orders/export?format=csv&${exportParams}`}><FiDownload />CSV</a></Button><Button asChild variant="outline" size="sm"><a href={`/api/admin/orders/export?format=xls&${exportParams}`}><FiDownload />Excel</a></Button></>} />
      <DataPanel className="mb-5 p-4 sm:p-5">
        <form method="get" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="xl:col-span-2"><span className="caption-label mb-2 block">Pesquisa livre</span><span className="relative block"><FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" aria-hidden="true" /><input name="q" defaultValue={params.q} className="input-control pl-11" placeholder="Pedido, cliente, email ou gateway ID" /></span></label>
          <label><span className="caption-label mb-2 block">Status</span><select name="status" defaultValue={status ?? ""} className="input-control"><option value="">Todos</option>{statuses.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label><span className="caption-label mb-2 block">Produto</span><select name="product" defaultValue={params.product ?? ""} className="input-control"><option value="">Todos</option>{getPublishedProducts().map((product) => <option key={product.slug} value={product.slug}>{product.title}</option>)}</select></label>
          <label><span className="caption-label mb-2 block">E-mail</span><input name="email" type="search" defaultValue={params.email} className="input-control" placeholder="cliente@email.com" /></label>
          <label><span className="caption-label mb-2 block">Data inicial</span><input name="from" type="date" defaultValue={params.from} className="input-control" /></label>
          <label><span className="caption-label mb-2 block">Data final</span><input name="to" type="date" defaultValue={params.to} className="input-control" /></label>
          <div className="grid grid-cols-2 gap-3"><label><span className="caption-label mb-2 block">Valor mín.</span><input name="min" inputMode="decimal" defaultValue={params.min} className="input-control" placeholder="0,00" /></label><label><span className="caption-label mb-2 block">Valor máx.</span><input name="max" inputMode="decimal" defaultValue={params.max} className="input-control" placeholder="500,00" /></label></div>
          <div className="flex items-end gap-2 xl:col-start-4"><Button type="submit" className="flex-1"><FiFilter />Filtrar</Button><Button asChild variant="ghost"><Link href="/admin/pedidos">Limpar</Link></Button></div>
        </form>
      </DataPanel>
      <DataPanel>
        {result.items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-left text-sm"><thead className="border-b border-white/[.08] bg-white/[.018] text-[10px] uppercase tracking-[.12em] text-zinc-500"><tr><th className="px-5 py-4">Pedido</th><th className="px-4 py-4">Cliente</th><th className="px-4 py-4">Produto</th><th className="px-4 py-4">Valor</th><th className="px-4 py-4">Gateway</th><th className="px-4 py-4">Status</th><th className="px-4 py-4">Criado</th><th className="px-4 py-4">Atualizado</th><th className="px-5 py-4 text-right">Ações</th></tr></thead><tbody className="divide-y divide-white/[.065]">{result.items.map((order) => <tr key={order.externalReference} className="transition-colors hover:bg-white/[.02]"><td className="px-5 py-4 font-mono text-xs text-zinc-300">{order.externalReference.slice(0, 8)}…</td><td className="px-4 py-4"><strong className="block max-w-52 truncate text-white">{order.payerName || "Cliente"}</strong><span className="mt-1 block max-w-52 truncate text-xs text-zinc-500">{order.payerEmail}</span></td><td className="max-w-56 px-4 py-4 text-zinc-300">{getProductBySlug(order.productSlug)?.title ?? order.productSlug}</td><td className="px-4 py-4 font-bold text-white">{formatCurrency(order.amount)}</td><td className="px-4 py-4 text-zinc-400">{order.gateway === "stripe" ? "Stripe" : "Mercado Pago"}</td><td className="px-4 py-4"><PaymentStatusBadge status={order.status} /></td><td className="px-4 py-4 text-xs text-zinc-500">{formatDateTime(order.createdAt)}</td><td className="px-4 py-4 text-xs text-zinc-500">{formatDateTime(order.updatedAt)}</td><td className="px-5 py-4 text-right"><Button asChild variant="ghost" size="sm"><Link href={`/admin/pedidos/${order.externalReference}`} aria-label={`Abrir pedido ${order.externalReference}`}><FiEye />Detalhes</Link></Button></td></tr>)}</tbody></table></div> : <EmptyState />}
        <Pagination pathname="/admin/pedidos" page={result.page} totalPages={result.totalPages} params={{ q: params.q, status: params.status, product: params.product, email: params.email, from: params.from, to: params.to, min: params.min, max: params.max }} />
      </DataPanel>
    </>
  );
}
