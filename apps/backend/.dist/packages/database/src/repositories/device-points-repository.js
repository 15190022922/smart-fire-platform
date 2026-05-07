"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTenantDevicePoints = listTenantDevicePoints;
exports.upsertTenantDevicePoint = upsertTenantDevicePoint;
exports.deleteTenantDevicePoint = deleteTenantDevicePoint;
const client_1 = require("../client");
const errors_1 = require("../errors");
const transaction_1 = require("../transaction");
const audit_repository_1 = require("./audit-repository");
const _shared_1 = require("./_shared");
async function listTenantDevicePoints(tenantId) {
    (0, errors_1.assertTenantId)(tenantId);
    const rows = await (0, client_1.queryDb)(`SELECT p.*
     FROM tenant_device_points p
     JOIN tenant_devices d ON d.tenant_id = p.tenant_id AND d.id = p.device_id
     WHERE p.tenant_id = $1 AND COALESCE(d.lifecycle_status, 'active') = 'active'
     ORDER BY p.updated_at DESC`, [tenantId]);
    return rows.rows.map(_shared_1.mapDevicePoint);
}
async function upsertTenantDevicePoint(tenantId, input) {
    (0, errors_1.assertTenantId)(tenantId);
    const updatedAt = (0, _shared_1.formatLocalTimestamp)();
    return (0, transaction_1.withTransaction)(async (client) => {
        let buildingId = input.buildingId?.trim() ?? "";
        let floorId = input.floorId?.trim() ?? "";
        const device = await client.query("SELECT id FROM tenant_devices WHERE tenant_id = $1 AND id = $2 AND COALESCE(lifecycle_status, 'active') = 'active' LIMIT 1", [
            tenantId,
            input.deviceId,
        ]);
        const drawing = await client.query("SELECT id, building_id, floor_id FROM tenant_drawings WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, input.drawingId]);
        if (device.rowCount === 0)
            throw new errors_1.EntityNotFoundError("device", input.deviceId);
        if (drawing.rowCount === 0)
            throw new errors_1.EntityNotFoundError("drawing", input.drawingId);
        buildingId = buildingId || String(drawing.rows[0].building_id ?? "");
        floorId = floorId || String(drawing.rows[0].floor_id ?? "");
        if (!buildingId) {
            throw new errors_1.RepositoryError("buildingId is required", "VALIDATION_ERROR");
        }
        if (String(drawing.rows[0].building_id ?? "") !== buildingId || String(drawing.rows[0].floor_id ?? "") !== floorId) {
            throw new Error("DRAWING_FLOOR_MISMATCH");
        }
        if (floorId) {
            const floor = await client.query("SELECT id FROM tenant_floors WHERE tenant_id = $1 AND id = $2 AND building_id = $3 LIMIT 1", [
                tenantId,
                floorId,
                buildingId,
            ]);
            if (floor.rowCount === 0)
                throw new errors_1.EntityNotFoundError("floor", floorId);
        }
        else {
            const area = await client.query("SELECT id, has_floors FROM tenant_buildings WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, buildingId]);
            if (area.rowCount === 0)
                throw new errors_1.EntityNotFoundError("spatial_area", buildingId);
            if (area.rows[0].has_floors !== false)
                throw new errors_1.RepositoryError("AREA_REQUIRES_FLOOR", "AREA_REQUIRES_FLOOR");
        }
        const existing = input.id
            ? await client.query("SELECT * FROM tenant_device_points WHERE id = $1 AND tenant_id = $2 LIMIT 1", [input.id, tenantId])
            : await client.query("SELECT * FROM tenant_device_points WHERE device_id = $1 AND tenant_id = $2 LIMIT 1", [input.deviceId, tenantId]);
        const id = existing.rows[0]?.id ?? (0, _shared_1.createId)("point");
        await client.query(`
        INSERT INTO tenant_device_points (id, tenant_id, device_id, building_id, floor_id, drawing_id, x, y, rotation, icon, status_style, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (id) DO UPDATE SET
          device_id = EXCLUDED.device_id,
          building_id = EXCLUDED.building_id,
          floor_id = EXCLUDED.floor_id,
          drawing_id = EXCLUDED.drawing_id,
          x = EXCLUDED.x,
          y = EXCLUDED.y,
          rotation = EXCLUDED.rotation,
          icon = EXCLUDED.icon,
          status_style = EXCLUDED.status_style,
          updated_at = EXCLUDED.updated_at
      `, [
            id,
            tenantId,
            input.deviceId,
            buildingId,
            floorId,
            input.drawingId,
            input.x,
            input.y,
            input.rotation ?? 0,
            input.icon ?? "sensor",
            input.statusStyle ?? "normal",
            updatedAt,
        ]);
        await client.query("UPDATE tenant_devices SET floor_id = $1 WHERE tenant_id = $2 AND id = $3", [floorId, tenantId, input.deviceId]);
        await (0, audit_repository_1.insertAuditLog)(client, {
            id: (0, _shared_1.createId)("audit"),
            tenantId,
            actorScope: "tenant",
            actorName: input.operatorName ?? "tenant_console",
            actorRole: input.operatorRole ?? "tenant_console",
            action: existing.rowCount ? "device_point.update" : "device_point.create",
            targetType: "device_point",
            targetId: id,
            result: "success",
            detail: `${input.deviceId} -> ${input.drawingId} (${input.x},${input.y})`,
            createdAt: updatedAt,
        });
        const row = await client.query("SELECT * FROM tenant_device_points WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, id]);
        return (0, _shared_1.mapDevicePoint)(row.rows[0]);
    });
}
async function deleteTenantDevicePoint(tenantId, pointId, input) {
    (0, errors_1.assertTenantId)(tenantId);
    const updatedAt = (0, _shared_1.formatLocalTimestamp)();
    return (0, transaction_1.withTransaction)(async (client) => {
        const point = await client.query("SELECT * FROM tenant_device_points WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, pointId]);
        if (point.rowCount === 0) {
            throw new errors_1.EntityNotFoundError("device_point", pointId);
        }
        await client.query("DELETE FROM tenant_device_points WHERE tenant_id = $1 AND id = $2", [tenantId, pointId]);
        await (0, audit_repository_1.insertAuditLog)(client, {
            id: (0, _shared_1.createId)("audit"),
            tenantId,
            actorScope: "tenant",
            actorName: input?.operatorName ?? "tenant_console",
            actorRole: input?.operatorRole ?? "tenant_console",
            action: "device_point.delete",
            targetType: "device_point",
            targetId: pointId,
            result: "success",
            detail: String(point.rows[0].device_id),
            createdAt: updatedAt,
        });
        return { success: true };
    });
}
