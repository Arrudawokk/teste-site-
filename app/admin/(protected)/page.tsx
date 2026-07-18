import Link from "next/link";
import { FiActivity, FiAlertTriangle, FiArrowUpRight, FiCheckCircle, FiClock, FiCreditCard, FiDownload, FiRefreshCw, FiShoppingBag, FiTrendingUp, FiUserCheck, FiUsers, FiXCircle, FiZap } from "react-icons/fi";
import { AdminPageHeader, DataPanel, EmptyState, PaymentStatusBadge, StatCard } from "@/components/admin/AdminUI";
import { RevenueChart } from "@/components/admin/OperationsCharts";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatDateTime } from "@/lib/admin/format";
import { getAdminStore } from "@/lib/admin/store";
import { getProductBySlug } from "@/lib/catalog";

export default async function AdminDashboardPage() {
  const store = getAdminStore();
  const [metrics, recentOrders, series] = await Promise.all([
    store.getMetrics(),
    store.listOrders({ page: 1, pageSize: 6 }),
    store.getSalesSeries(14),
  ]);
  return (
    <>
      <AdminPageHeader eyebrow="Centro de operações" title="Visão geral" description="Acompanhe vendas, receita, clientes e sinais operacionais em uma única visão." actions={<Button asChild variant="outline"><Link href="/admin/pedidos">Ver pedidos<FiArrowUpRight /></Link></Button>} />
      <section aria-label="Indicadores principais" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total de vendas" value={String(metrics.totalSales)} detail="Pedidos aprovados" icon={FiShoppingBag} tone="green" />
        <StatCard label="Faturamento total" value={formatCurrency(metrics.totalRevenue)} detail="Receita aprovada" icon={FiTrendingUp} tone="green" />
        <StatCard label="Faturamento hoje" value={formatCurrency(metrics.revenueToday)} detail="Atualizado em tempo real" icon={FiZap} tone="blue" />
        <StatCard label="Conversão" value={`${metrics.conversionRate.toFixed(1)}%`} detail={`${metrics.checkoutStarted} checkouts iniciados`} icon={FiActivity} tone="violet" />
      </section>
      <section aria-label="Estados dos pedidos" className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <StatCard label="Pendentes" value={String(metrics.pendingOrders)} icon={FiClock} tone="amber" />
        <StatCard label="Aprovados" value={String(metrics.approvedOrders)} icon={FiCheckCircle} tone="green" />
        <StatCard label="Cancelados" value={String(metrics.cancelledOrders)} icon={FiXCircle} tone="red" />
        <StatCard label="Expirados" value={String(metrics.expiredOrders)} icon={FiAlertTriangle} tone="amber" />
        <StatCard label="Abandonados" value={String(metrics.abandonedCheckouts)} icon={FiRefreshCw} tone="amber" />
        <StatCard label="Reembolsos" value={String(metrics.refunds)} icon={FiRefreshCw} tone="red" />
        <StatCard label="Chargebacks" value={String(metrics.chargebacks)} icon={FiAlertTriangle} tone="red" />
        <StatCard label="Clientes" value={String(metrics.customers)} icon={FiUsers} tone="blue" />
        <StatCard label="Downloads" value={String(metrics.downloads)} icon={FiDownload} tone="violet" />
        <StatCard label="Checkouts" value={String(metrics.checkoutStarted)} icon={FiCreditCard} tone="blue" />
      </section>
      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,.65fr)]">
        <DataPanel className="p-5 sm:p-6"><div className="mb-5 flex items-center justify-between gap-4"><div><p className="caption-label">Últimos 14 dias</p><h2 className="mt-2 text-lg font-bold">Receita e vendas</h2></div><FiTrendingUp className="text-blue-300" aria-hidden="true" /></div><RevenueChart points={series} /></DataPanel>
        <DataPanel>
          <div className="flex items-center justify-between border-b border-white/[.07] px-5 py-4"><div><p className="caption-label">Atividade recente</p><h2 className="mt-2 text-lg font-bold">Últimos pedidos</h2></div><FiUserCheck className="text-emerald-300" aria-hidden="true" /></div>
          {recentOrders.items.length ? <div className="divide-y divide-white/[.07]">{recentOrders.items.map((order) => <Link key={order.externalReference} href={`/admin/pedidos/${order.externalReference}`} className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-white/[.025]"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[.04] text-zinc-300"><FiShoppingBag aria-hidden="true" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-white">{order.payerName || order.payerEmail}</strong><span className="mt-1 block truncate text-xs text-zinc-500">{getProductBySlug(order.productSlug)?.title ?? order.productSlug} · {formatDateTime(order.createdAt)}</span></span><span className="text-right"><strong className="block text-sm text-white">{formatCurrency(order.amount)}</strong><span className="mt-1 block"><PaymentStatusBadge status={order.status} /></span></span></Link>)}</div> : <EmptyState title="Nenhum pedido ainda" />}
        </DataPanel>
      </div>
    </>
  );
}
