import "server-only";
import { createHash, pbkdf2 as pbkdf2Callback, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AdminSession } from "./types";
import { ADMIN_SESSION_COOKIE } from "./constants";
import { getAdminStore } from "./store";

const SESSION_SECONDS = 60 * 60 * 8;
const PASSWORD_ITERATIONS_MIN = 210_000;
const pbkdf2 = promisify(pbkdf2Callback);

export class AdminConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminConfigurationError";
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedAdminEmail(): string {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AdminConfigurationError("ADMIN_EMAIL não configurado corretamente.");
  return email;
}

function passwordHashParts(): { iterations: number; salt: Buffer; digest: Buffer } {
  const encoded = process.env.ADMIN_PASSWORD_HASH?.trim();
  const [algorithm, iterationsValue, saltValue, digestValue] = encoded?.split("$") ?? [];
  const iterations = Number(iterationsValue);
  if (algorithm !== "pbkdf2_sha256" || !Number.isInteger(iterations) || iterations < PASSWORD_ITERATIONS_MIN || !saltValue || !digestValue) {
    throw new AdminConfigurationError("ADMIN_PASSWORD_HASH não configurado corretamente.");
  }
  try {
    const salt = Buffer.from(saltValue, "base64url");
    const digest = Buffer.from(digestValue, "base64url");
    if (salt.length < 16 || digest.length !== 32) throw new Error("invalid");
    return { iterations, salt, digest };
  } catch {
    throw new AdminConfigurationError("ADMIN_PASSWORD_HASH não configurado corretamente.");
  }
}

export async function verifyAdminCredentials(email: string, password: string): Promise<boolean> {
  const configuredEmail = normalizedAdminEmail();
  const parts = passwordHashParts();
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedBuffer = Buffer.from(normalizedEmail);
  const configuredBuffer = Buffer.from(configuredEmail);
  const emailMatch = normalizedBuffer.length === configuredBuffer.length && timingSafeEqual(normalizedBuffer, configuredBuffer);
  const computed = await pbkdf2(password, parts.salt, parts.iterations, parts.digest.length, "sha256");
  return emailMatch && timingSafeEqual(computed, parts.digest);
}

export function hashAdminIdentity(email: string): string {
  return sha256(email.trim().toLowerCase());
}

export function hashLoginFingerprint(value: string): string {
  return sha256(value);
}

export async function issueAdminSession(email: string): Promise<AdminSession> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
  const session = await getAdminStore().createSession(sha256(token), hashAdminIdentity(email), expiresAt);
  (await cookies()).set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_SECONDS,
    priority: "high",
  });
  return session;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) return null;
  const session = await getAdminStore().getSession(sha256(token));
  if (!session || session.emailHash !== hashAdminIdentity(normalizedAdminEmail())) return null;
  return session;
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/entrar");
  return session;
}

export async function revokeAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (token && /^[a-f0-9]{64}$/i.test(token)) await getAdminStore().revokeSession(sha256(token));
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}
