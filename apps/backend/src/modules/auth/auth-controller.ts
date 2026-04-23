import type { ServerResponse } from "http";
import type { BackendRequestContext } from "./auth-context";
import { sendJson } from "../../lib/http";

export function requireTenantContext(res: ServerResponse, context: BackendRequestContext) {
  if (!context.tenantId || context.scope !== "tenant") {
    sendJson(res, 403, { message: "无权访问企业接口" });
    return false;
  }
  return true;
}

export function requirePlatformContext(res: ServerResponse, context: BackendRequestContext) {
  if (context.scope !== "platform") {
    sendJson(res, 403, { message: "无权访问平台接口" });
    return false;
  }
  return true;
}

export function getAuthSessionHandler(res: ServerResponse, context: BackendRequestContext) {
  sendJson(res, 200, {
    session: context.session,
    tenantId: context.tenantId,
    scope: context.scope,
    userName: context.userName,
    userRole: context.userRole,
  });
}
