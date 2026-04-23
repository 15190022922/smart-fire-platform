import type { ServerResponse } from "http";
import { tenantAuditRepository } from "../../../../../packages/database/src/tenant-repositories";
import { sendJson } from "../../lib/http";
import type { BackendRequestContext } from "../auth/auth-context";
import { requireTenantContext } from "../auth/auth-controller";

export async function getAuditLogs(res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const logs = await tenantAuditRepository.list(context.tenantId!);
  sendJson(res, 200, { logs });
}
