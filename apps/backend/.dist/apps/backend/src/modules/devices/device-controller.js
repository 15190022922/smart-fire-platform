"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDevices = getDevices;
exports.postDevice = postDevice;
exports.deleteDevice = deleteDevice;
exports.previewDeviceLifecycle = previewDeviceLifecycle;
exports.updateDeviceLifecycle = updateDeviceLifecycle;
exports.getDeviceAttributes = getDeviceAttributes;
exports.postDeviceAttribute = postDeviceAttribute;
exports.deleteDeviceAttribute = deleteDeviceAttribute;
exports.previewDeviceImport = previewDeviceImport;
exports.commitDeviceImport = commitDeviceImport;
const http_1 = require("../../lib/http");
const auth_controller_1 = require("../auth/auth-controller");
const tenant_repositories_1 = require("../../../../../packages/database/src/tenant-repositories");
const server_1 = require("../../../../../packages/realtime/src/server");
async function getDevices(res, context, url) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const lifecycle = url.searchParams.get("lifecycle") ?? "active";
    const devices = await tenant_repositories_1.tenantDeviceRepository.list(context.tenantId, lifecycle === "disabled" || lifecycle === "all" ? lifecycle : "active");
    (0, http_1.sendJson)(res, 200, { devices });
}
async function postDevice(req, res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const body = (await (0, http_1.readJsonBody)(req));
    if (!body.deviceCode?.trim() ||
        !body.name?.trim() ||
        !body.type?.trim() ||
        !body.area?.trim() ||
        !body.installationLocation?.trim()) {
        (0, http_1.sendJson)(res, 400, { message: "设备编码、设备名称、设备类型、所属区域和安装位置不能为空" });
        return;
    }
    try {
        const device = await tenant_repositories_1.tenantDeviceRepository.upsert(context.tenantId, {
            ...body,
            deviceCode: body.deviceCode.trim(),
            name: body.name.trim(),
            type: body.type.trim(),
            area: body.area.trim(),
            installationLocation: body.installationLocation.trim(),
            status: body.status || "正常",
            installationStatus: body.installationStatus || "",
            lastReportAt: body.lastReportAt || "",
            notes: body.notes || "",
            customAttributes: body.customAttributes ?? {},
        });
        (0, server_1.publishTenantEvent)(context.tenantId, {
            type: "device_status_changed",
            tenantId: context.tenantId,
            deviceId: device.id,
            eventType: body.id ? "device_updated" : "device_created",
            eventCode: body.id ? "DEVICE_UPDATED" : "DEVICE_CREATED",
            reportedAt: device.lastReportAt,
            occurredAt: device.lastReportAt,
            source: "tenant_console",
        });
        (0, http_1.sendJson)(res, 200, { device });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "设备保存失败";
        (0, http_1.sendJson)(res, 500, { message });
    }
}
async function deleteDevice(req, res, context, url) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const id = url.searchParams.get("id");
    if (!id) {
        (0, http_1.sendJson)(res, 400, { message: "设备 id 必填" });
        return;
    }
    await tenant_repositories_1.tenantDeviceRepository.remove(context.tenantId, id);
    const occurredAt = new Date().toISOString();
    (0, server_1.publishTenantEvent)(context.tenantId, {
        type: "device_status_changed",
        tenantId: context.tenantId,
        deviceId: id,
        eventType: "device_deleted",
        eventCode: "DEVICE_DELETED",
        reportedAt: occurredAt,
        occurredAt,
        source: "tenant_console",
    });
    (0, http_1.sendJson)(res, 200, { success: true });
}
async function previewDeviceLifecycle(req, res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const body = await (0, http_1.readJsonBody)(req);
    const preview = await tenant_repositories_1.tenantDeviceRepository.previewLifecycle(context.tenantId, body);
    (0, http_1.sendJson)(res, 200, preview);
}
async function updateDeviceLifecycle(req, res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const body = await (0, http_1.readJsonBody)(req);
    const result = await tenant_repositories_1.tenantDeviceRepository.updateLifecycle(context.tenantId, body);
    const occurredAt = new Date().toISOString();
    (0, server_1.publishTenantEvent)(context.tenantId, {
        type: "device_status_changed",
        tenantId: context.tenantId,
        eventType: "device_lifecycle_changed",
        eventCode: "DEVICE_LIFECYCLE_CHANGED",
        reportedAt: occurredAt,
        occurredAt,
        source: "tenant_console",
    });
    (0, http_1.sendJson)(res, 200, result);
}
async function getDeviceAttributes(res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const attributes = await tenant_repositories_1.tenantDeviceAttributeRepository.list(context.tenantId);
    (0, http_1.sendJson)(res, 200, { attributes });
}
async function postDeviceAttribute(req, res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const body = await (0, http_1.readJsonBody)(req);
    try {
        const attribute = await tenant_repositories_1.tenantDeviceAttributeRepository.upsert(context.tenantId, body);
        (0, http_1.sendJson)(res, 200, { attribute });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "设备字段保存失败";
        (0, http_1.sendJson)(res, 400, { message });
    }
}
async function deleteDeviceAttribute(res, context, url) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const fieldKey = url.searchParams.get("fieldKey");
    if (!fieldKey) {
        (0, http_1.sendJson)(res, 400, { message: "字段 key 必填" });
        return;
    }
    try {
        await tenant_repositories_1.tenantDeviceAttributeRepository.disable(context.tenantId, fieldKey);
        (0, http_1.sendJson)(res, 200, { success: true });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "设备字段停用失败";
        (0, http_1.sendJson)(res, 400, { message });
    }
}
async function previewDeviceImport(req, res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const body = await (0, http_1.readJsonBody)(req);
    const preview = await tenant_repositories_1.tenantDeviceImportRepository.preview(context.tenantId, body);
    (0, http_1.sendJson)(res, 200, preview);
}
async function commitDeviceImport(req, res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const body = await (0, http_1.readJsonBody)(req);
    const result = await tenant_repositories_1.tenantDeviceImportRepository.commit(context.tenantId, body);
    const occurredAt = new Date().toISOString();
    (0, server_1.publishTenantEvent)(context.tenantId, {
        type: "device_status_changed",
        tenantId: context.tenantId,
        eventType: "device_imported",
        eventCode: "DEVICE_IMPORT_IMPORTED",
        reportedAt: occurredAt,
        occurredAt,
        source: "tenant_console",
    });
    (0, http_1.sendJson)(res, 200, result);
}
