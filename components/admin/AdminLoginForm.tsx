"use client";

import { useActionState } from "react";
import { FiLock, FiMail } from "react-icons/fi";
import { loginAdmin, type AdminLoginState } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const initialState: AdminLoginState = {};

export function AdminLoginForm({ returnTo }: { returnTo: string }) {
  const [state, action, pending] = useActionState(loginAdmin, initialState);
  return (
    <form action={action} className="mt-8 space-y-5">
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className="block"><span className="caption-label mb-2 block">E-mail administrativo</span><span className="relative block"><FiMail className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-zinc-500" aria-hidden="true" /><Input name="email" type="email" autoComplete="username" required maxLength={254} className="pl-11" placeholder="admin@empresa.com" /></span></label>
      <label className="block"><span className="caption-label mb-2 block">Senha</span><span className="relative block"><FiLock className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-zinc-500" aria-hidden="true" /><Input name="password" type="password" autoComplete="current-password" required minLength={12} maxLength={256} className="pl-11" placeholder="Sua senha administrativa" /></span></label>
      {state.error ? <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">{state.error}</p> : null}
      <Button type="submit" size="lg" className="w-full rounded-xl" isLoading={pending} loadingLabel="Verificando">Entrar no painel</Button>
    </form>
  );
}
