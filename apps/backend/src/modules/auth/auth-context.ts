import type { IncomingMessage } from "http";
import { AUTH_COOKIE_NAME, decodeSharedSession, type SharedAuthSession } from "../../../../../packages/shared/src/auth";

export type BackendRequestContext = {
  session: SharedAuthSession | null;
  tenantId: string | null;
  scope: "platform" | "tenant" | null;
  userName: string | null;
  userRole: string | null;
};

function decodeHeaderValue(value?: string) {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseCookies(cookieHeader?: string) {
  if (!cookieHeader) return new Map<string, string>();
  return new Map(
    cookieHeader.split(";").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key, rest.join("=")];
    }),
  );
}

export function resolveRequestContext(req: IncomingMessage): BackendRequestContext {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.get(AUTH_COOKIE_NAME);
  const cookieSession = token ? decodeSharedSession(token) : null;

  const scopeHeader = req.headers["x-user-scope"];
  const tenantHeader = req.headers["x-tenant-id"];
  const userNameHeader = req.headers["x-user-name"];
  const userRoleHeader = req.headers["x-user-role"];

  return {
    session: cookieSession,
    tenantId:
      (typeof tenantHeader === "string" ? tenantHeader : undefined) ??
      cookieSession?.tenantId ??
      null,
    scope:
      (typeof scopeHeader === "string" ? (scopeHeader as "platform" | "tenant") : undefined) ??
      cookieSession?.scope ??
      null,
    userName:
      decodeHeaderValue(typeof userNameHeader === "string" ? userNameHeader : undefined) ??
      cookieSession?.displayName ??
      null,
    userRole:
      (typeof userRoleHeader === "string" ? userRoleHeader : undefined) ??
      (cookieSession?.roleKey as string | undefined) ??
      null,
  };
}
