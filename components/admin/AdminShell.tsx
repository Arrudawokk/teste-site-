import Link from "next/link";
import { FiLogOut, FiSearch, FiShield } from "react-icons/fi";
import { logoutAdmin } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";
import { AdminNav } from "./AdminNav";

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#06080d] text-white" data-admin>
      <div className="premium-grid pointer-events-none fixed inset-0 opacity-20" />
      <header className="relative z-20 border-b border-white/[.07] bg-[#070a10]/90 backdrop-blur-xl lg:hidden">
        <div className="container-default flex min-h-18 items-center justify-between gap-4">
          <Link href="/admin" className="flex items-center gap-3 rounded-xl focus-visible:ring-2 focus-visible:ring-blue-400"><span className="brand-mark" aria-hidden="true">E</span><span className="brand-wordmark">EscalaHub</span></Link>
          <span className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400"><FiShield aria-hidden="true" />Admin</span>
        </div>
      </header>
      <div className="relative mx-auto grid min-h-screen w-full max-w-[1600px] lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden border-r border-white/[.07] bg-[#080b11]/88 px-5 py-7 backdrop-blur-xl lg:flex lg:flex-col">
          <Link href="/admin" className="flex items-center gap-3 rounded-xl focus-visible:ring-2 focus-visible:ring-blue-400"><span className="brand-mark" aria-hidden="true">E</span><span className="brand-wordmark">EscalaHub</span></Link>
          <div className="mt-8 rounded-xl border border-emerald-400/15 bg-emerald-400/[.06] px-3.5 py-3"><p className="flex items-center gap-2 text-xs font-bold text-emerald-200"><span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.7)]" />Operação online</p><p className="mt-1.5 text-[11px] text-zinc-500">Ambiente administrativo auditado</p></div>
          <div className="mt-7 flex-1"><AdminNav /></div>
          <form action={logoutAdmin} className="border-t border-white/[.07] pt-4"><Button type="submit" variant="ghost" className="w-full justify-start text-zinc-400"><FiLogOut aria-hidden="true" />Encerrar sessão</Button></form>
        </aside>
        <div className="min-w-0">
          <div className="border-b border-white/[.07] bg-[#080b11]/70 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <form action="/admin/pedidos" method="get" role="search" className="relative w-full max-w-xl"><FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" aria-hidden="true" /><input name="q" className="input-control h-11 pl-11" placeholder="Buscar pedido, cliente, e-mail ou ID do gateway" aria-label="Busca global" /></form>
              <div className="min-w-0 lg:hidden"><AdminNav mobile /></div>
              <span className="hidden items-center gap-2 whitespace-nowrap text-xs font-semibold text-zinc-500 sm:flex"><FiShield aria-hidden="true" className="text-blue-300" />Acesso protegido</span>
            </div>
          </div>
          <main className="p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
