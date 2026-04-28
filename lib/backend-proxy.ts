import { getBackendBaseUrl, buildBackendHeaders } from "@/lib/backend-client";
import type { AuthSession } from "@/types/auth";

export async function proxyBackendJson(
  path: string,
  init: RequestInit & { session: AuthSession | null } = { session: null },
) {
  const { session, headers, ...rest } = init;
  const response = await fetch(`${getBackendBaseUrl()}${path}`, {
    ...rest,
    headers: {
      ...buildBackendHeaders(session),
      ...(headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await response.text();
  return new Response(text, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8",
    },
  });
}

export async function proxyBackendStream(
  path: string,
  init: RequestInit & { session: AuthSession | null } = { session: null },
) {
  const { session, headers, ...rest } = init;
  const response = await fetch(`${getBackendBaseUrl()}${path}`, {
    ...rest,
    headers: {
      ...buildBackendHeaders(session),
      ...(headers ?? {}),
    },
    cache: "no-store",
  });

  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "text/event-stream",
      "Cache-Control": response.headers.get("cache-control") || "no-cache, no-transform",
      Connection: response.headers.get("connection") || "keep-alive",
      "X-Accel-Buffering": response.headers.get("x-accel-buffering") || "no",
    },
  });
}
