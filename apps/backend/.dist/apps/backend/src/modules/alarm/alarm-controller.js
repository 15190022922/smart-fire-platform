"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAlarmCenter = getAlarmCenter;
exports.patchAlarmCenter = patchAlarmCenter;
const http_1 = require("../../lib/http");
const auth_controller_1 = require("../auth/auth-controller");
const tenant_repositories_1 = require("../../../../../packages/database/src/tenant-repositories");
const allowedWorkflowStatuses = new Set(["未处理", "已确认", "处理中", "已完成", "已关闭"]);
async function getAlarmCenter(res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const alarms = await tenant_repositories_1.tenantAlarmRepository.list(context.tenantId);
    (0, http_1.sendJson)(res, 200, { alarms });
}
async function patchAlarmCenter(req, res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const body = (await (0, http_1.readJsonBody)(req));
    if (!body.alarmId || !body.nextStatus || !allowedWorkflowStatuses.has(body.nextStatus)) {
        (0, http_1.sendJson)(res, 400, { message: "报警编号或目标状态无效" });
        return;
    }
    try {
        const result = await tenant_repositories_1.tenantAlarmRepository.updateWorkflow(context.tenantId, {
            alarmId: body.alarmId,
            nextStatus: body.nextStatus,
            falseAlarm: body.falseAlarm,
            note: body.note,
            attachments: body.attachments,
            assignedUserName: body.assignedUserName,
            operatorName: context.userName ?? "backend_api",
            operatorRole: context.userRole ?? "backend_api",
        });
        (0, http_1.sendJson)(res, 200, result);
    }
    catch (error) {
        if (error instanceof Error && error.message === "ALARM_NOT_FOUND") {
            (0, http_1.sendJson)(res, 404, { message: "报警记录不存在" });
            return;
        }
        (0, http_1.sendJson)(res, 500, { message: "报警闭环更新失败" });
    }
}
