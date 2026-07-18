"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { IconType } from "react-icons";
import { FiActivity, FiBarChart2, FiCreditCard, FiFileText, FiHome, FiUsers, FiZap } from "react-icons/fi";
import { cn } from "@/lib/cn";

const navigation: Array<{ href: string; label: string; icon: IconType }> = [
  { href: "/admin", label: "Visão geral", icon: FiHome },
  { href: "/admin/pedidos", label: "Pedidos", icon: FiCreditCard },
  { href: "/admin/clientes", label: "Clientes", icon: FiUsers },
  { href: "/admin/webhooks", label: "Webhooks Stripe", icon: FiZap },
  { href: "/admin/logs", label: "Logs", icon: FiFileText },
  { href: "/admin/estatisticas", label: "Estatísticas", icon: FiBarChart2 },
];

export function AdminNav({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Administração" className={mobile ? "flex gap-2 overflow-x-auto pb-1" : "space-y-1.5"}>
      {navigation.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
        return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-xl border px-3.5 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-blue-400", mobile && "shrink-0", active ? "border-blue-400/20 bg-blue-400/10 text-blue-100" : "border-transparent text-zinc-400 hover:bg-white/[.04] hover:text-white")}><Icon aria-hidden="true" className="size-4 shrink-0" />{label}{active && !mobile ? <FiActivity aria-hidden="true" className="ml-auto size-3 text-blue-300" /> : null}</Link>;
      })}
    </nav>
  );
}
