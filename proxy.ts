import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin/constants";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin/entrar") return NextResponse.next();

  const hasSessionCookie = /^[a-f0-9]{64}$/i.test(request.cookies.get(ADMIN_SESSION_COOKIE)?.value ?? "");
  if (hasSessionCookie) return NextResponse.next();

  if (pathname.startsWith("/api/admin/")) {
    return NextResponse.json({ error: "Autenticação administrativa obrigatória." }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  }

  const loginUrl = new URL("/admin/entrar", request.url);
  loginUrl.searchParams.set("returnTo", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
