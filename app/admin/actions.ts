"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hashAdminIdentity, hashLoginFingerprint, issueAdminSession, revokeAdminSession, verifyAdminCredentials } from "@/lib/admin/auth";
import { getAdminStore } from "@/lib/admin/store";

export type AdminLoginState = { error?: string };

export async function loginAdmin(_state: AdminLoginState, formData: FormData): Promise<AdminLoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const returnToValue = String(formData.get("returnTo") ?? "/admin");
  const returnTo = returnToValue.startsWith("/admin") && !returnToValue.startsWith("/admin/entrar") ? returnToValue : "/admin";
  if (!email || email.length > 254 || password.length < 12 || password.length > 256) return { error: "Credenciais inválidas." };

  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = requestHeaders.get("user-agent")?.slice(0, 160) ?? "unknown";
  const fingerprint = hashLoginFingerprint(`${forwarded}|${userAgent}`);
  const store = getAdminStore();

  try {
    if (await store.countRecentFailedLogins(fingerprint, 15) >= 5) return { error: "Muitas tentativas. Aguarde 15 minutos." };
    const valid = await verifyAdminCredentials(email, password);
    await store.recordLoginAttempt(fingerprint, valid);
    if (!valid) {
      await store.recordAudit({ level: "warn", event: "admin.login_failed", actorType: "admin", actorIdHash: hashAdminIdentity(email), entityType: "admin_session", entityId: null, orderId: null, gatewayPaymentId: null, status: "rejected", requestId: fingerprint.slice(0, 24), source: "admin.login", latencyMs: null });
      return { error: "Credenciais inválidas." };
    }
    const session = await issueAdminSession(email);
    await store.recordAudit({ level: "info", event: "admin.login_succeeded", actorType: "admin", actorIdHash: session.emailHash, entityType: "admin_session", entityId: session.id, orderId: null, gatewayPaymentId: null, status: "active", requestId: fingerprint.slice(0, 24), source: "admin.login", latencyMs: null });
  } catch {
    return { error: "Acesso administrativo temporariamente indisponível." };
  }
  redirect(returnTo);
}

export async function logoutAdmin(): Promise<void> {
  await revokeAdminSession();
  redirect("/admin/entrar");
}
