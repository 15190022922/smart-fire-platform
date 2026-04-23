import type { ServerResponse } from "http";
import { tenantNotificationRepository } from "../../../../../packages/database/src/tenant-repositories";
import { sendJson } from "../../lib/http";
import type { BackendRequestContext } from "../auth/auth-context";
import { requireTenantContext } from "../auth/auth-controller";

export async function getNotificationCenter(res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const payload = await tenantNotificationRepository.getCenterData(context.tenantId!);
  sendJson(res, 200, payload);
}
