import { FiClipboard } from "react-icons/fi";
import { AccountShell } from "@/components/account/AccountShell";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { getCustomerAccountData } from "@/lib/account/data";
import type { PaymentMethodType, PaymentStatus } from "@/lib/payments/types";

const statusPresentation: Record<PaymentStatus, { label: string; variant: BadgeVariant }> = {
  approved: { label: "Aprovado", variant: "success" },
  pending: { label: "Pendente", variant: "warning" },
  in_process: { label: "Em análise", variant: "info" },
  rejected: { label: "Recusado", variant: "danger" },
  cancelled: { label: "Cancelado", variant: "neutral" },
  refunded: { label: "Reembolsado", variant: "neutral" },
  charged_back: { label: "Contestado", variant: "danger" },
};

const methodLabel: Record<PaymentMethodType, string> = {
  pix: "Pix",
  card: "Cartão",
  stripe_checkout: "Stripe Checkout",
};

export default async function CustomerOrdersPage() {
  const data = await getCustomerAccountData();
  return (
    <AccountShell profile={data.profile}>
      <p className="eyebrow">Histórico</p>
      <h1 className="display-title mt-4 text-3xl font-semibold sm:text-4xl">Meus pedidos</h1>
      <p className="mt-3 text-sm leading-6 text-zinc-400">Acompanhe compras, valores e estados de pagamento.</p>
      {data.orders.length ? (
        <div className="mt-8 space-y-3">
          {data.orders.map((order) => {
            const status = statusPresentation[order.status];
            return (
              <article key={order.id} className="card grid gap-5 p-5 sm:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(110px,.6fr))] sm:items-center">
                <div className="min-w-0"><strong className="block truncate text-sm text-white">{order.productTitle}</strong><span className="mt-1 block truncate font-mono text-[10px] text-zinc-600">{order.id}</span></div>
                <div><span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-600">Valor</span><strong className="mt-1 block text-sm">{order.amount}</strong></div>
                <div><span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-600">Pagamento</span><span className="mt-1 block text-sm text-zinc-300">{methodLabel[order.method]}</span></div>
                <div><span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-600">Status</span><Badge className="mt-2" variant={status.variant}>{status.label}</Badge></div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-white/[.06] pt-4 text-xs text-zinc-500 sm:col-span-4"><span>{order.gateway}</span><span>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.purchasedAt))}</span></div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="card mt-8 p-10 text-center"><FiClipboard className="mx-auto text-4xl text-zinc-600" /><h2 className="mt-4 text-xl font-bold">Nenhum pedido encontrado</h2><p className="mt-2 text-sm text-zinc-500">Seu histórico aparecerá aqui após uma compra.</p></div>
      )}
    </AccountShell>
  );
}
