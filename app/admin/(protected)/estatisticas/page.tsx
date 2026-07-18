import { FiActivity, FiDownload, FiShoppingBag, FiTrendingUp, FiUsers } from "react-icons/fi";
import { AdminPageHeader, DataPanel, StatCard } from "@/components/admin/AdminUI";
import { OperationsChart, RevenueChart } from "@/components/admin/OperationsCharts";
import { formatCurrency } from "@/lib/admin/format";
import { getAdminStore } from "@/lib/admin/store";

export default async function AdminStatisticsPage() {
  const store = getAdminStore();
  const [metrics, series] = await Promise.all([store.getMetrics(), store.getSalesSeries(30)]);
  return <><AdminPageHeader eyebrow="Inteligência operacional" title="Estatísticas" description="Indicadores dos últimos 30 dias para acompanhar receita, conversão, abandono, downloads e clientes." /><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><StatCard label="Receita total" value={formatCurrency(metrics.totalRevenue)} icon={FiTrendingUp} tone="green" /><StatCard label="Vendas" value={String(metrics.totalSales)} icon={FiShoppingBag} tone="green" /><StatCard label="Conversão" value={`${metrics.conversionRate.toFixed(1)}%`} icon={FiActivity} tone="violet" /><StatCard label="Clientes" value={String(metrics.customers)} icon={FiUsers} tone="blue" /><StatCard label="Downloads" value={String(metrics.downloads)} icon={FiDownload} tone="amber" /></section><div className="mt-6 grid gap-6 xl:grid-cols-2"><DataPanel className="p-5 sm:p-6"><p className="caption-label">Performance financeira</p><h2 className="mt-2 text-lg font-bold">Vendas e receita por dia</h2><div className="mt-5"><RevenueChart points={series} /></div></DataPanel><DataPanel className="p-5 sm:p-6"><p className="caption-label">Funil operacional</p><h2 className="mt-2 text-lg font-bold">Checkouts, abandonos e downloads</h2><div className="mt-5"><OperationsChart points={series} /></div></DataPanel></div></>;
}
