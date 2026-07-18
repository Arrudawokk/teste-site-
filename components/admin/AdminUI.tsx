import Link from "next/link";
import type { IconType } from "react-icons";
import { FiArrowLeft, FiArrowRight, FiInbox } from "react-icons/fi";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import type { PaymentStatus } from "@/lib/payments/types";
import { cn } from "@/lib/cn";
import { statusLabels } from "@/lib/admin/format";

export function AdminPageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: React.ReactNode }) {
  return <header className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow">{eyebrow}</p><h1 className="display-title mt-3 text-3xl font-semibold sm:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">{description}</p></div>{actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}</header>;
}

export function StatCard({ label, value, detail, icon: Icon, tone = "blue" }: { label: string; value: string; detail?: string; icon: IconType; tone?: "blue" | "green" | "amber" | "red" | "violet" }) {
  const tones = { blue: "bg-blue-400/10 text-blue-200", green: "bg-emerald-400/10 text-emerald-200", amber: "bg-amber-400/10 text-amber-200", red: "bg-red-400/10 text-red-200", violet: "bg-violet-400/10 text-violet-200" };
  return <article className="card p-5"><div className="flex items-start justify-between gap-4"><div><p className="caption-label">{label}</p><p className="mt-3 text-2xl font-semibold tracking-[-.04em] text-white">{value}</p>{detail ? <p className="mt-2 text-xs text-zinc-500">{detail}</p> : null}</div><span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tones[tone])}><Icon aria-hidden="true" className="size-[18px]" /></span></div></article>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const variants: Record<PaymentStatus, BadgeVariant> = { pending: "warning", in_process: "info", approved: "success", rejected: "danger", cancelled: "neutral", refunded: "warning", charged_back: "danger" };
  return <Badge variant={variants[status]}>{statusLabels[status]}</Badge>;
}

export function EmptyState({ title = "Nenhum resultado", description = "Ajuste os filtros ou aguarde novos dados operacionais." }: { title?: string; description?: string }) {
  return <div className="grid min-h-56 place-items-center p-8 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-white/[.04] text-zinc-400"><FiInbox aria-hidden="true" /></span><h2 className="mt-4 text-base font-bold text-white">{title}</h2><p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">{description}</p></div></div>;
}

export function Pagination({ pathname, page, totalPages, params }: { pathname: string; page: number; totalPages: number; params: Record<string, string | undefined> }) {
  const href = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
    search.set("page", String(target));
    return `${pathname}?${search.toString()}`;
  };
  if (totalPages <= 1) return null;
  return <nav aria-label="Paginação" className="flex items-center justify-between gap-4 border-t border-white/[.07] px-4 py-4 sm:px-5"><span className="text-xs text-zinc-500">Página {page} de {totalPages}</span><div className="flex gap-2">{page > 1 ? <Link href={href(page - 1)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-bold text-zinc-300 hover:bg-white/[.05]"><FiArrowLeft aria-hidden="true" />Anterior</Link> : null}{page < totalPages ? <Link href={href(page + 1)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-bold text-zinc-300 hover:bg-white/[.05]">Próxima<FiArrowRight aria-hidden="true" /></Link> : null}</div></nav>;
}

export function DataPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("overflow-hidden rounded-[var(--radius-panel)] border border-white/[.08] bg-[#0b1018]/90 shadow-[var(--shadow-card)]", className)}>{children}</section>;
}
