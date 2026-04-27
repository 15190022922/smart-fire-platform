"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNotificationCenter = getNotificationCenter;
exports.patchNotificationCenter = patchNotificationCenter;
const tenant_repositories_1 = require("../../../../../packages/database/src/tenant-repositories");
const http_1 = require("../../lib/http");
const auth_controller_1 = require("../auth/auth-controller");
const http_2 = require("../../lib/http");
const runtime_metrics_1 = require("../../lib/runtime-metrics");
async function getNotificationCenter(res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const payload = await tenant_repositories_1.tenantNotificationRepository.getCenterData(context.tenantId);
    (0, http_1.sendJson)(res, 200, payload);
}
async function patchNotificationCenter(req, res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const body = (await (0, http_2.readJsonBody)(req));
    if (!body.recordId) {
        (0, http_1.sendJson)(res, 400, { message: "缺少通知记录编号" });
        return;
    }
    try {
        await tenant_repositories_1.tenantNotificationRepository.retry(context.tenantId, body.recordId);
        (0, http_1.sendJson)(res, 200, { success: true, recordId: body.recordId });
    }
    catch (error) {
        (0, runtime_metrics_1.recordNotificationFailure)("notification_retry_failed", error instanceof Error ? error.message : String(error));
        (0, http_1.sendJson)(res, 500, { message: "通知重试失败" });
    }
}
