import type { IncomingMessage, ServerResponse } from "http";
import { tenantNotificationRepository } from "../../../../../packages/database/src/tenant-repositories";
import { sendJson } from "../../lib/http";
import type { BackendRequestContext } from "../auth/auth-context";
import { requireTenantContext } from "../auth/auth-controller";
import { readJsonBody } from "../../lib/http";
import { recordNotificationFailure } from "../../lib/runtime-metrics";

export async function getNotificationCenter(res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const payload = await tenantNotificationRepository.getCenterData(context.tenantId!);
  sendJson(res, 200, payload);
}

export async function patchNotificationCenter(
  req: IncomingMessage,
  res: ServerResponse,
  context: BackendRequestContext,
) {
  if (!requireTenantContext(res, context)) return;
  const body = (await readJsonBody(req)) as { recordId?: string };
  if (!body.recordId) {
    sendJson(res, 400, { message: "缺少通知记录编号" });
    return;
  }

  try {
    await tenantNotificationRepository.retry(context.tenantId!, body.recordId);
    sendJson(res, 200, { success: true, recordId: body.recordId });
  } catch (error) {
    recordNotificationFailure("notification_retry_failed", error instanceof Error ? error.message : String(error));
    sendJson(res, 500, { message: "通知重试失败" });
  }
}
