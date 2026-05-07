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

function redirectAndClearSession(url: URL) {
  const response = NextResponse.redirect(url);
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}

function nextAndClearSession() {
  const response = NextResponse.next();
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const scope = token ? decodeScope(token) : null;
  const hasInvalidSession = Boolean(token && !scope);
  const isTenantPath =
    pathname === "/" ||
    pathname === "/alarm-center" ||
    pathname === "/duty-center" ||
    pathname === "/inspection" ||
    pathname === "/notification-center" ||
    pathname === "/devices" ||
    pathname === "/history" ||
    pathname === "/audit-log" ||
    pathname === "/system-health" ||
    pathname === "/spaces" ||
    pathname === "/profile" ||
    pathname === "/users" ||
    pathname === "/settings" ||
    pathname === "/subscription";

  if (pathname.startsWith("/admin")) {
    if (!token || hasInvalidSession) {
      return redirectAndClearSession(new URL("/login", request.url));
    }
    if (scope !== "platform") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  if (pathname.startsWith("/simulator")) {
    if (!token || hasInvalidSession) {
      return redirectAndClearSession(new URL("/login", request.url));
    }
    if (scope !== "platform") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  if (pathname.startsWith("/workspace")) {
    if (!token || hasInvalidSession) {
      return redirectAndClearSession(new URL("/login", request.url));
    }
    return NextResponse.redirect(new URL(scope === "platform" ? "/admin" : "/", request.url));
  }

  if (isTenantPath) {
    if (!token || hasInvalidSession) {
      return redirectAndClearSession(new URL("/login", request.url));
    }
    if (scope !== "tenant") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  if (pathname === "/login" && token) {
    if (hasInvalidSession) {
      return nextAndClearSession();
    }
    return NextResponse.redirect(new URL(scope === "platform" ? "/admin" : "/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/alarm-center",
    "/duty-center",
    "/inspection",
    "/notification-center",
    "/devices",
    "/history",
    "/audit-log",
    "/system-health",
    "/spaces",
    "/profile",
    "/users",
    "/settings",
    "/subscription",
    "/simulator",
    "/admin/:path*",
    "/workspace/:path*",
    "/login",
  ],
};
