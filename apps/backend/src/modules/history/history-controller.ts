import type { ServerResponse } from "http";
import { historyRepository } from "../../../../../packages/database/src/ops-repositories";
import { sendJson } from "../../lib/http";
import type { BackendRequestContext } from "../auth/auth-context";
import { requireTenantContext } from "../auth/auth-controller";

export async function getTenantHistory(res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const payload = await historyRepository.getTenantHistoryData(context.tenantId!);
  sendJson(res, 200, payload);
}
