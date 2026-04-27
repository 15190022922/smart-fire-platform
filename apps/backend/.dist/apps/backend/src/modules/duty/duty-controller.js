"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDutyCenter = getDutyCenter;
exports.postDutySchedule = postDutySchedule;
exports.patchDutyCenter = patchDutyCenter;
const http_1 = require("../../lib/http");
const auth_controller_1 = require("../auth/auth-controller");
const tenant_repositories_1 = require("../../../../../packages/database/src/tenant-repositories");
async function getDutyCenter(res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const payload = await tenant_repositories_1.tenantDutyRepository.getCenterData(context.tenantId);
    (0, http_1.sendJson)(res, 200, payload);
}
async function postDutySchedule(req, res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const body = (await (0, http_1.readJsonBody)(req));
    if (!body.dutyDate || !body.shiftId || !body.assigneeName || !body.assigneePhone) {
        (0, http_1.sendJson)(res, 400, { message: "排班参数不完整" });
        return;
    }
    await tenant_repositories_1.tenantDutyRepository.createSchedule(context.tenantId, {
        dutyDate: body.dutyDate,
        shiftId: body.shiftId,
        assigneeName: body.assigneeName,
        assigneePhone: body.assigneePhone,
        assignedBy: context.userName ?? "backend_api",
    });
    const payload = await tenant_repositories_1.tenantDutyRepository.getCenterData(context.tenantId);
    (0, http_1.sendJson)(res, 200, payload);
}
async function patchDutyCenter(req, res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const body = (await (0, http_1.readJsonBody)(req));
    if (!body.scheduleId) {
        (0, http_1.sendJson)(res, 400, { message: "缺少当前班次记录" });
        return;
    }
    try {
        await tenant_repositories_1.tenantDutyRepository.handover(context.tenantId, {
            scheduleId: body.scheduleId,
            nextScheduleId: body.nextScheduleId,
            note: body.note ?? "",
            operatorName: context.userName ?? "backend_api",
        });
    }
    catch (error) {
        if (error instanceof Error && error.message === "HANDOVER_NOTE_REQUIRED") {
            (0, http_1.sendJson)(res, 400, { message: "存在未闭环报警时必须填写交接说明" });
            return;
        }
        throw error;
    }
    const payload = await tenant_repositories_1.tenantDutyRepository.getCenterData(context.tenantId);
    (0, http_1.sendJson)(res, 200, payload);
}
