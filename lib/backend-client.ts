import type { AuthSession } from "@/types/auth";
import { AUTH_COOKIE_NAME } from "@/lib/auth-shared";
import { encodeSession } from "@/lib/auth";

export function getBackendBaseUrl() {
  return process.env.BACKEND_BASE_URL || "http://localhost:4001";
}

function encodeHeaderValue(value?: string | null) {
  if (!value) return "";
  return encodeURIComponent(value);
}

export function buildBackendHeaders(session: AuthSession | null) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-backend-internal-token": process.env.BACKEND_INTERNAL_TOKEN || "",
    "x-user-scope": session?.scope ?? "",
    "x-tenant-id": session?.tenantId ?? "",
    "x-user-name": encodeHeaderValue(session?.displayName || session?.username || ""),
    "x-user-role": String(session?.roleKey ?? ""),
  };

  if (session) {
    headers.Cookie = `${AUTH_COOKIE_NAME}=${encodeSession(session)}`;
  }

  return headers;
}

export async function fetchBackendJson<T>(
  path: string,
  init: RequestInit & { session?: AuthSession | null } = {},
) {
  const { session, headers, ...rest } = init;
  const response = await fetch(`${getBackendBaseUrl()}${path}`, {
    ...rest,
    headers: {
      ...buildBackendHeaders(session ?? null),
      ...(headers ?? {}),
    },
    cache: "no-store",
  });

  return response as Response & {
    json(): Promise<T>;
  };
}
