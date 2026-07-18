import Link from "next/link";
import { notFound } from "next/navigation";
import { FiArrowLeft, FiCheckCircle, FiClock, FiCloud, FiCreditCard, FiDownload, FiFileText, FiLink, FiMail, FiPackage, FiShield, FiUser } from "react-icons/fi";
import { AdminPageHeader, DataPanel, PaymentStatusBadge } from "@/components/admin/AdminUI";
import { ReprocessButton } from "@/components/admin/ReprocessButton";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatDateTime } from "@/lib/admin/format";
import { getAdminStore } from "@/lib/admin/store";
import { getProductBySlug } from "@/lib/catalog";

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getAdminStore().getOrderDetail(id);
  if (!detail) notFound();
  const { order } = detail;
  const product = getProductBySlug(order.productSlug);
  const timeline = [
    { id: "created", event: "Pedido criado", date: order.createdAt, detail: "Pedido registrado na EscalaHub." },
    ...(order.gatewayPaymentId ? [{ id: "checkout", event: "Checkout criado", date: order.createdAt, detail: `Sessão ${order.gatewayPaymentId}` }] : []),
    ...detail.webhooks.map((event) => ({ id: `webhook-${event.id}`, event: event.eventType || "Webhook recebido", date: event.receivedAt, detail: event.result })),
    ...detail.timeline.map((event) => ({ id: `audit-${event.id}`, event: event.event, date: event.createdAt, detail: `${event.source}${event.status ? ` · ${event.status}` : ""}` })),
    ...(order.accessGrantedAt ? [{ id: "access", event: "Acesso liberado", date: order.accessGrantedAt, detail: "Produto disponível para o cliente." }] : []),
  ].sort((left, right) => Date.parse(left.date) - Date.parse(right.date));
  return (
    <>
      <AdminPageHeader eyebrow="Detalhes do pedido" title={`Pedido ${order.externalReference.slice(0, 8)}`} description="Visão consolidada do comprador, pagamento, entrega e histórico operacional." actions={<><Button asChild variant="ghost"><Link href="/admin/pedidos"><FiArrowLeft />Voltar</Link></Button><ReprocessButton orderId={order.externalReference} /></>} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <DataPanel className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="caption-label">Status atual</p><div className="mt-3"><PaymentStatusBadge status={order.status} /></div></div><div className="text-right"><p className="caption-label">Valor</p><p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(order.amount)}</p></div></div><div className="divider my-6" /><dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><Info icon={FiUser} label="Comprador" value={order.payerName || "Não informado"} /><Info icon={FiMail} label="E-mail" value={order.payerEmail} /><Info icon={FiPackage} label="Produto" value={product?.title ?? order.productSlug} /><Info icon={FiCreditCard} label="Método" value={order.method === "stripe_checkout" ? "Stripe Checkout" : order.method} /><Info icon={FiCloud} label="Gateway" value={order.gateway === "stripe" ? "Stripe" : "Mercado Pago"} /><Info icon={FiShield} label="Acesso" value={order.accessStatus} /></dl></DataPanel>
          <DataPanel><div className="border-b border-white/[.07] px-5 py-4"><p className="caption-label">Histórico permanente</p><h2 className="mt-2 text-lg font-bold">Timeline completa</h2></div><ol className="relative space-y-0 p-5 sm:p-6">{timeline.map((item, index) => <li key={item.id} className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-3 pb-6 last:pb-0"><span className="relative z-10 mt-0.5 grid size-7 place-items-center rounded-full border border-blue-400/20 bg-blue-400/10 text-blue-200">{index === timeline.length - 1 ? <FiCheckCircle className="size-3.5" /> : <FiClock className="size-3.5" />}</span>{index < timeline.length - 1 ? <span className="absolute bottom-0 left-[13px] top-7 w-px bg-white/10" /> : null}<div><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-white">{item.event}</strong><time className="text-xs text-zinc-500">{formatDateTime(item.date)}</time></div><p className="mt-1 text-xs leading-5 text-zinc-500">{item.detail}</p></div></li>)}</ol></DataPanel>
          <DataPanel><div className="border-b border-white/[.07] px-5 py-4"><p className="caption-label">Eventos Stripe</p><h2 className="mt-2 text-lg font-bold">Webhooks recebidos</h2></div>{detail.webhooks.length ? <div className="divide-y divide-white/[.07]">{detail.webhooks.map((event) => <details key={event.id} className="group px-5 py-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-4"><span><strong className="block text-sm text-white">{event.eventType || "Evento legado"}</strong><span className="mt-1 block font-mono text-[11px] text-zinc-500">{event.eventId || event.id}</span></span><span className="text-right text-xs text-zinc-500">{formatDateTime(event.receivedAt)}<span className="mt-1 block text-emerald-300">{event.result}</span></span></summary><pre className="mt-4 max-h-72 overflow-auto rounded-xl border border-white/[.07] bg-black/25 p-4 text-xs leading-5 text-zinc-300">{JSON.stringify(event.payload, null, 2)}</pre></details>)}</div> : <p className="p-5 text-sm text-zinc-500">Nenhum webhook registrado para este pedido.</p>}</DataPanel>
        </div>
        <aside className="space-y-6">
          <DataPanel className="p-5"><p className="caption-label">Identificadores</p><dl className="mt-4 space-y-4"><CodeInfo label="Order ID" value={order.externalReference} /><CodeInfo label="Checkout Session ID" value={order.gatewayPaymentId ?? "Não disponível"} /><CodeInfo label="Gateway Payment ID" value={order.gatewayPaymentId ?? "Não disponível"} /></dl></DataPanel>
          <DataPanel className="p-5"><p className="caption-label">Entrega e conta</p><dl className="mt-4 space-y-4"><Info icon={FiUser} label="Conta criada" value={order.accountCreated ? "Sim" : "Não"} /><Info icon={FiClock} label="Último login" value={formatDateTime(detail.customerLastLoginAt)} /><Info icon={FiDownload} label="Downloads" value={String(order.downloadCount)} /><Info icon={FiFileText} label="Webhooks" value={String(order.webhookCount)} /><Info icon={FiLink} label="Arquivo privado" value={product?.delivery.objectKey ?? "Produto fora do catálogo"} /></dl></DataPanel>
          <DataPanel className="p-5"><p className="caption-label">Datas</p><dl className="mt-4 space-y-4"><CodeInfo label="Criado" value={formatDateTime(order.createdAt)} /><CodeInfo label="Atualizado" value={formatDateTime(order.updatedAt)} /><CodeInfo label="Sincronizado" value={formatDateTime(order.gatewaySyncedAt)} /></dl></DataPanel>
        </aside>
      </div>
    </>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof FiUser; label: string; value: string }) {
  return <div className="flex min-w-0 gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/[.04] text-zinc-400"><Icon aria-hidden="true" className="size-4" /></span><span className="min-w-0"><dt className="caption-label">{label}</dt><dd className="mt-1 break-words text-sm text-zinc-200">{value}</dd></span></div>;
}

function CodeInfo({ label, value }: { label: string; value: string }) {
  return <div><dt className="caption-label">{label}</dt><dd className="mt-1.5 break-all rounded-lg bg-white/[.035] px-3 py-2 font-mono text-[11px] leading-5 text-zinc-300">{value}</dd></div>;
}
