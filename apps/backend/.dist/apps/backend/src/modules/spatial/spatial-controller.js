"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTenantOverview = getTenantOverview;
exports.getTenantSpatialModel = getTenantSpatialModel;
exports.postTenantSpatialArea = postTenantSpatialArea;
exports.patchTenantSpatialArea = patchTenantSpatialArea;
exports.deleteTenantSpatialArea = deleteTenantSpatialArea;
exports.postTenantFloor = postTenantFloor;
exports.patchTenantFloor = patchTenantFloor;
exports.deleteTenantFloor = deleteTenantFloor;
exports.getTenantDrawings = getTenantDrawings;
exports.postTenantDrawing = postTenantDrawing;
exports.publishTenantDrawing = publishTenantDrawing;
exports.archiveTenantDrawing = archiveTenantDrawing;
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
        (0, http_1.sendJson)(res, 400, { message: "drawing target mismatch", code: "DRAWING_FLOOR_MISMATCH" });
        return;
    }
    const message = error instanceof Error ? error.message : fallbackMessage;
    (0, http_1.sendJson)(res, 500, { message });
}
function lastPathSegment(url) {
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? "";
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
async function postTenantSpatialArea(req, res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const body = (await (0, http_1.readJsonBody)(req));
    if (!body.name?.trim()) {
        (0, http_1.sendJson)(res, 400, { message: "name is required" });
        return;
    }
    try {
        const result = await tenant_repositories_1.tenantSpatialAreaRepository.create(context.tenantId, {
            siteId: body.siteId,
            name: body.name.trim(),
            code: body.code,
            areaType: body.areaType,
            hasFloors: body.hasFloors,
            sortOrder: Number(body.sortOrder ?? 0),
            status: body.status,
            description: body.description,
            floors: Array.isArray(body.floors)
                ? body.floors
                    .filter((floor) => floor.name?.trim())
                    .map((floor) => ({
                    id: floor.id,
                    name: floor.name.trim(),
                    code: floor.code,
                    levelIndex: floor.levelIndex,
                    sortOrder: floor.sortOrder,
                    status: floor.status,
                    description: floor.description,
                }))
                : undefined,
            operatorName: context.userName ?? "tenant_console",
            operatorRole: context.userRole ?? "tenant_console",
        });
        (0, http_1.sendJson)(res, 200, result);
    }
    catch (error) {
        sendRepositoryError(res, error, "spatial area create failed");
    }
}
async function patchTenantSpatialArea(req, res, context, url) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const areaId = lastPathSegment(url);
    const body = (await (0, http_1.readJsonBody)(req));
    if (!areaId) {
        (0, http_1.sendJson)(res, 400, { message: "area id is required" });
        return;
    }
    try {
        const result = await tenant_repositories_1.tenantSpatialAreaRepository.update(context.tenantId, areaId, {
            siteId: body.siteId,
            name: body.name,
            code: body.code,
            areaType: body.areaType,
            hasFloors: body.hasFloors,
            sortOrder: body.sortOrder,
            status: body.status,
            description: body.description,
            floors: Array.isArray(body.floors)
                ? body.floors
                    .filter((floor) => floor.name?.trim())
                    .map((floor) => ({
                    id: floor.id,
                    name: floor.name.trim(),
                    code: floor.code,
                    levelIndex: floor.levelIndex,
                    sortOrder: floor.sortOrder,
                    status: floor.status,
                    description: floor.description,
                }))
                : undefined,
            deletedFloorIds: Array.isArray(body.deletedFloorIds) ? body.deletedFloorIds : undefined,
            operatorName: context.userName ?? "tenant_console",
            operatorRole: context.userRole ?? "tenant_console",
        });
        (0, http_1.sendJson)(res, 200, result);
    }
    catch (error) {
        sendRepositoryError(res, error, "spatial area update failed");
    }
}
async function deleteTenantSpatialArea(res, context, url) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const areaId = lastPathSegment(url);
    if (!areaId) {
        (0, http_1.sendJson)(res, 400, { message: "area id is required" });
        return;
    }
    try {
        const result = await tenant_repositories_1.tenantSpatialAreaRepository.remove(context.tenantId, areaId, {
            operatorName: context.userName ?? "tenant_console",
            operatorRole: context.userRole ?? "tenant_console",
        });
        (0, http_1.sendJson)(res, 200, result);
    }
    catch (error) {
        sendRepositoryError(res, error, "spatial area delete failed");
    }
}
async function postTenantFloor(req, res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const body = (await (0, http_1.readJsonBody)(req));
    if (!body.buildingId?.trim() || !body.name?.trim()) {
        (0, http_1.sendJson)(res, 400, { message: "buildingId and name are required" });
        return;
    }
    try {
        const floor = await tenant_repositories_1.tenantFloorRepository.create(context.tenantId, {
            buildingId: body.buildingId.trim(),
            name: body.name.trim(),
            code: body.code,
            levelIndex: Number(body.levelIndex ?? 1),
            sortOrder: Number(body.sortOrder ?? body.levelIndex ?? 1),
            status: body.status,
            description: body.description,
            operatorName: context.userName ?? "tenant_console",
            operatorRole: context.userRole ?? "tenant_console",
        });
        (0, http_1.sendJson)(res, 200, { floor });
    }
    catch (error) {
        sendRepositoryError(res, error, "floor create failed");
    }
}
async function patchTenantFloor(req, res, context, url) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const floorId = lastPathSegment(url);
    const body = (await (0, http_1.readJsonBody)(req));
    if (!floorId) {
        (0, http_1.sendJson)(res, 400, { message: "floor id is required" });
        return;
    }
    try {
        const floor = await tenant_repositories_1.tenantFloorRepository.update(context.tenantId, floorId, {
            name: body.name,
            code: body.code,
            levelIndex: body.levelIndex,
            sortOrder: body.sortOrder,
            status: body.status,
            description: body.description,
            operatorName: context.userName ?? "tenant_console",
            operatorRole: context.userRole ?? "tenant_console",
        });
        (0, http_1.sendJson)(res, 200, { floor });
    }
    catch (error) {
        sendRepositoryError(res, error, "floor update failed");
    }
}
async function deleteTenantFloor(res, context, url) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const floorId = lastPathSegment(url);
    if (!floorId) {
        (0, http_1.sendJson)(res, 400, { message: "floor id is required" });
        return;
    }
    try {
        const result = await tenant_repositories_1.tenantFloorRepository.remove(context.tenantId, floorId, {
            operatorName: context.userName ?? "tenant_console",
            operatorRole: context.userRole ?? "tenant_console",
        });
        (0, http_1.sendJson)(res, 200, result);
    }
    catch (error) {
        sendRepositoryError(res, error, "floor delete failed");
    }
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
    if (!(body.buildingId?.trim() || body.floorId?.trim()) || !body.name?.trim() || !body.fileUrl?.trim()) {
        (0, http_1.sendJson)(res, 400, { message: "buildingId or floorId, name and fileUrl are required" });
        return;
    }
    try {
        const drawing = await tenant_repositories_1.tenantDrawingRepository.create(context.tenantId, {
            buildingId: body.buildingId?.trim(),
            floorId: body.floorId?.trim(),
            name: body.name.trim(),
            fileUrl: body.fileUrl.trim(),
            fileType: body.fileType,
            sourceFileUrl: body.sourceFileUrl?.trim(),
            previewUrl: body.previewUrl?.trim(),
            originalFileName: body.originalFileName?.trim(),
            fileSize: Number(body.fileSize ?? 0),
            processingStatus: body.processingStatus,
            processingMessage: body.processingMessage?.trim(),
            conversionLog: Array.isArray(body.conversionLog) ? body.conversionLog : [],
            sceneUrl: body.sceneUrl?.trim(),
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
        sendRepositoryError(res, error, "drawing save failed");
    }
}
async function publishTenantDrawing(url, res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const parts = url.pathname.split("/");
    const drawingId = parts[parts.length - 2];
    if (!drawingId) {
        (0, http_1.sendJson)(res, 400, { message: "drawing id is required" });
        return;
    }
    try {
        const drawing = await tenant_repositories_1.tenantDrawingRepository.updateStatus(context.tenantId, drawingId, "published", {
            operatorName: context.userName ?? "tenant_console",
            operatorRole: context.userRole ?? "tenant_console",
        });
        (0, http_1.sendJson)(res, 200, { drawing });
    }
    catch (error) {
        sendRepositoryError(res, error, "drawing publish failed");
    }
}
async function archiveTenantDrawing(url, res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const parts = url.pathname.split("/");
    const drawingId = parts[parts.length - 2];
    if (!drawingId) {
        (0, http_1.sendJson)(res, 400, { message: "drawing id is required" });
        return;
    }
    try {
        const drawing = await tenant_repositories_1.tenantDrawingRepository.updateStatus(context.tenantId, drawingId, "archived", {
            operatorName: context.userName ?? "tenant_console",
            operatorRole: context.userRole ?? "tenant_console",
        });
        (0, http_1.sendJson)(res, 200, { drawing });
    }
    catch (error) {
        sendRepositoryError(res, error, "drawing archive failed");
    }
}
async function deleteTenantDrawing(url, res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const drawingId = url.searchParams.get("id");
    if (!drawingId) {
        (0, http_1.sendJson)(res, 400, { message: "drawing id is required" });
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
        sendRepositoryError(res, error, "drawing delete failed");
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
    if (!body.deviceId || !body.drawingId) {
        (0, http_1.sendJson)(res, 400, { message: "deviceId and drawingId are required" });
        return;
    }
    try {
        const point = await tenant_repositories_1.tenantDevicePointRepository.upsert(context.tenantId, {
            id: body.id,
            deviceId: body.deviceId,
            buildingId: body.buildingId,
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
        sendRepositoryError(res, error, "device point save failed");
    }
}
async function deleteTenantDevicePoint(url, res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const pointId = url.searchParams.get("id");
    if (!pointId) {
        (0, http_1.sendJson)(res, 400, { message: "point id is required" });
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
        sendRepositoryError(res, error, "device point delete failed");
    }
}
