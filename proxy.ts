import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth-shared";

function decodeScope(token: string) {
  try {
    const normalized = token.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = atob(padded);
    const session = JSON.parse(decoded) as { scope?: "platform" | "tenant" };
    return session.scope ?? null;
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const scope = token ? decodeScope(token) : null;
  const isTenantPath =
    pathname === "/" ||
    pathname === "/devices" ||
    pathname === "/users" ||
    pathname === "/settings" ||
    pathname === "/subscription";

  if (pathname.startsWith("/admin")) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (scope !== "platform") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  if (pathname.startsWith("/workspace")) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.redirect(new URL(scope === "platform" ? "/admin" : "/", request.url));
  }

  if (isTenantPath) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (scope !== "tenant") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  if (pathname === "/login" && token) {
    return NextResponse.redirect(new URL(scope === "platform" ? "/admin" : "/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/devices",
    "/users",
    "/settings",
    "/subscription",
    "/admin/:path*",
    "/workspace/:path*",
    "/login",
  ],
};
