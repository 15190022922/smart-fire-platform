"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTenantOverview = getTenantOverview;
exports.getTenantSpatialModel = getTenantSpatialModel;
exports.getTenantDrawings = getTenantDrawings;
exports.postTenantDrawing = postTenantDrawing;
exports.deleteTenantDrawing = deleteTenantDrawing;
exports.getTenantDevicePoints = getTenantDevicePoints;
exports.postTenantDevicePoint = postTenantDevicePoint;
exports.deleteTenantDevicePoint = deleteTenantDevicePoint;
const errors_1 = require("../../../../../packages/database/src/errors");
const tenant_repositories_1 = require("../../../../../packages/database/src/tenant-repositories");
const http_1 = require("../../lib/http");
const auth_controller_1 = require("../auth/auth-controller");
function sendRepositoryError(res, error, fallbackMessage) {
    if (error instanceof errors_1.EntityNotFoundError) {
        (0, http_1.sendJson)(res, 404, { message: error.message, code: error.code });
        return;
    }
    if (error instanceof errors_1.TenantScopeError) {
        (0, http_1.sendJson)(res, 403, { message: error.message, code: error.code });
        return;
    }
    if (error instanceof errors_1.RepositoryError) {
        (0, http_1.sendJson)(res, 400, { message: error.message, code: error.code });
        return;
    }
    if (error instanceof Error && error.message === "DRAWING_FLOOR_MISMATCH") {
        (0, http_1.sendJson)(res, 400, { message: "图纸与楼层不匹配", code: "DRAWING_FLOOR_MISMATCH" });
        return;
    }
    const message = error instanceof Error ? error.message : fallbackMessage;
    (0, http_1.sendJson)(res, 500, { message });
}
async function getTenantOverview(res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const payload = await tenant_repositories_1.tenantOverviewRepository.getOverview(context.tenantId);
    (0, http_1.sendJson)(res, 200, payload);
}
async function getTenantSpatialModel(res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const payload = await tenant_repositories_1.tenantOverviewRepository.getSpatialModel(context.tenantId);
    (0, http_1.sendJson)(res, 200, payload);
}
async function getTenantDrawings(res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const drawings = await tenant_repositories_1.tenantDrawingRepository.list(context.tenantId);
    (0, http_1.sendJson)(res, 200, { drawings });
}
async function postTenantDrawing(req, res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const body = (await (0, http_1.readJsonBody)(req));
    if (!body.floorId || !body.name?.trim() || !body.fileUrl?.trim()) {
        (0, http_1.sendJson)(res, 400, { message: "floorId、name、fileUrl 必填" });
        return;
    }
    try {
        const drawing = await tenant_repositories_1.tenantDrawingRepository.create(context.tenantId, {
            floorId: body.floorId,
            name: body.name.trim(),
            fileUrl: body.fileUrl.trim(),
            width: Number(body.width ?? 0),
            height: Number(body.height ?? 0),
            version: String(body.version ?? "v1.0"),
            status: body.status,
            operatorName: context.userName ?? "tenant_console",
            operatorRole: context.userRole ?? "tenant_console",
        });
        (0, http_1.sendJson)(res, 200, { drawing });
    }
    catch (error) {
        sendRepositoryError(res, error, "图纸保存失败");
    }
}
async function deleteTenantDrawing(url, res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const drawingId = url.searchParams.get("id");
    if (!drawingId) {
        (0, http_1.sendJson)(res, 400, { message: "缺少图纸 ID" });
        return;
    }
    try {
        const result = await tenant_repositories_1.tenantDrawingRepository.remove(context.tenantId, drawingId, {
            operatorName: context.userName ?? "tenant_console",
            operatorRole: context.userRole ?? "tenant_console",
        });
        (0, http_1.sendJson)(res, 200, result);
    }
    catch (error) {
        sendRepositoryError(res, error, "图纸删除失败");
    }
}
async function getTenantDevicePoints(res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const points = await tenant_repositories_1.tenantDevicePointRepository.list(context.tenantId);
    (0, http_1.sendJson)(res, 200, { points });
}
async function postTenantDevicePoint(req, res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const body = (await (0, http_1.readJsonBody)(req));
    if (!body.deviceId || !body.floorId || !body.drawingId) {
        (0, http_1.sendJson)(res, 400, { message: "deviceId、floorId、drawingId 必填" });
        return;
    }
    try {
        const point = await tenant_repositories_1.tenantDevicePointRepository.upsert(context.tenantId, {
            id: body.id,
            deviceId: body.deviceId,
            floorId: body.floorId,
            drawingId: body.drawingId,
            x: Number(body.x ?? 0),
            y: Number(body.y ?? 0),
            rotation: Number(body.rotation ?? 0),
            icon: body.icon,
            statusStyle: body.statusStyle,
            operatorName: context.userName ?? "tenant_console",
            operatorRole: context.userRole ?? "tenant_console",
        });
        (0, http_1.sendJson)(res, 200, { point });
    }
    catch (error) {
        sendRepositoryError(res, error, "点位保存失败");
    }
}
async function deleteTenantDevicePoint(url, res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const pointId = url.searchParams.get("id");
    if (!pointId) {
        (0, http_1.sendJson)(res, 400, { message: "缺少点位 ID" });
        return;
    }
    try {
        const result = await tenant_repositories_1.tenantDevicePointRepository.remove(context.tenantId, pointId, {
            operatorName: context.userName ?? "tenant_console",
            operatorRole: context.userRole ?? "tenant_console",
        });
        (0, http_1.sendJson)(res, 200, result);
    }
    catch (error) {
        sendRepositoryError(res, error, "点位删除失败");
    }
}
