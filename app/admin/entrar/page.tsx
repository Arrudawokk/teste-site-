import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { getAdminSession } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  if (await getAdminSession()) redirect("/admin");
  const { returnTo = "/admin" } = await searchParams;
  const safeReturnTo = returnTo.startsWith("/admin") ? returnTo : "/admin";
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#06080d] px-4 py-12 text-white">
      <div className="premium-grid pointer-events-none absolute inset-0 opacity-35" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-blue-500/10 blur-[110px]" />
      <section className="card relative w-full max-w-md p-6 sm:p-8" aria-labelledby="admin-login-title">
        <Link href="/" className="inline-flex items-center gap-3 rounded-xl focus-visible:ring-2 focus-visible:ring-blue-400"><span className="brand-mark" aria-hidden="true">E</span><span className="brand-wordmark">EscalaHub</span></Link>
        <p className="eyebrow mt-9">Operações protegidas</p>
        <h1 id="admin-login-title" className="display-title mt-3 text-3xl font-semibold">Painel administrativo</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">Acesso restrito aos responsáveis pela operação. Todas as ações são auditadas.</p>
        <AdminLoginForm returnTo={safeReturnTo} />
      </section>
    </main>
  );
}
