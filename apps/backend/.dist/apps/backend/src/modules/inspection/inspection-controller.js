"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInspectionCenter = getInspectionCenter;
exports.postInspection = postInspection;
exports.patchInspection = patchInspection;
const http_1 = require("../../lib/http");
const auth_controller_1 = require("../auth/auth-controller");
const tenant_repositories_1 = require("../../../../../packages/database/src/tenant-repositories");
async function getInspectionCenter(res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const payload = await tenant_repositories_1.tenantInspectionRepository.getCenterData(context.tenantId);
    (0, http_1.sendJson)(res, 200, payload);
}
async function postInspection(req, res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const body = (await (0, http_1.readJsonBody)(req));
    if ((body.action ?? "create-task") === "submit-record") {
        if (!body.taskId || !body.result) {
            (0, http_1.sendJson)(res, 400, { message: "巡检执行参数不完整" });
            return;
        }
        await tenant_repositories_1.tenantInspectionRepository.submitRecord(context.tenantId, {
            taskId: body.taskId,
            result: body.result,
            note: body.note ?? "",
            inspectedBy: context.userName ?? "backend_api",
        });
    }
    else {
        if (!body.title ||
            !body.planType ||
            !body.targetType ||
            !body.targetId ||
            !body.targetName ||
            !body.dueDate ||
            !body.assignedTo) {
            (0, http_1.sendJson)(res, 400, { message: "巡检计划参数不完整" });
            return;
        }
        await tenant_repositories_1.tenantInspectionRepository.createTask(context.tenantId, {
            title: body.title,
            planType: body.planType,
            targetType: body.targetType,
            targetId: body.targetId,
            targetName: body.targetName,
            dueDate: body.dueDate,
            assignedTo: body.assignedTo,
            note: body.note ?? "",
            operatorName: context.userName ?? "backend_api",
        });
    }
    const payload = await tenant_repositories_1.tenantInspectionRepository.getCenterData(context.tenantId);
    (0, http_1.sendJson)(res, 200, payload);
}
async function patchInspection(req, res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const body = (await (0, http_1.readJsonBody)(req));
    if (!body.issueId || !body.status) {
        (0, http_1.sendJson)(res, 400, { message: "隐患状态参数不完整" });
        return;
    }
    await tenant_repositories_1.tenantInspectionRepository.updateIssue(context.tenantId, {
        issueId: body.issueId,
        status: body.status,
        note: body.note ?? "",
        operatorName: context.userName ?? "backend_api",
    });
    const payload = await tenant_repositories_1.tenantInspectionRepository.getCenterData(context.tenantId);
    (0, http_1.sendJson)(res, 200, payload);
}
