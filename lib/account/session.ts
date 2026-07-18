import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { OrderRecord } from "@/lib/payments/orderStore";
import { getAccountStore } from "./store";
import type { CustomerSession } from "./types";

const SESSION_COOKIE = "escalahub_account_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function getCustomerSession(): Promise<CustomerSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) return null;
  return getAccountStore().getSession(hashToken(token));
}

export async function issueCustomerSession(order: OrderRecord): Promise<CustomerSession | null> {
  if (order.status !== "approved" || order.accessStatus !== "granted") return null;
  const current = await getCustomerSession();
  if (current?.profile.email.toLowerCase() === order.payerEmail.toLowerCase()) return current;

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000).toISOString();
  const session = await getAccountStore().createSession(order, hashToken(token), expiresAt);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
    priority: "high",
  });
  return session;
}

export async function ensureCustomerAccount(order: OrderRecord): Promise<CustomerSession["profile"] | null> {
  if (order.status !== "approved" || order.accessStatus !== "granted") return null;
  return getAccountStore().ensureAccount(order);
}

export async function revokeCustomerSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token && /^[a-f0-9]{64}$/i.test(token)) await getAccountStore().revokeSession(hashToken(token));
  cookieStore.delete(SESSION_COOKIE);
}
