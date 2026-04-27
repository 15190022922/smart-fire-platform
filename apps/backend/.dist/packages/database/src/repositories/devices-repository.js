"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTenantDevices = listTenantDevices;
exports.getTenantDeviceById = getTenantDeviceById;
exports.upsertTenantDevice = upsertTenantDevice;
exports.deleteTenantDevice = deleteTenantDevice;
exports.upsertDeviceStatusSnapshot = upsertDeviceStatusSnapshot;
exports.updateTenantDeviceRuntime = updateTenantDeviceRuntime;
const client_1 = require("../client");
const errors_1 = require("../errors");
const _shared_1 = require("./_shared");
const _shared_2 = require("./_shared");
async function listTenantDevices(tenantId) {
    (0, errors_1.assertTenantId)(tenantId);
    const result = await (0, client_1.queryDb)("SELECT * FROM tenant_devices WHERE tenant_id = $1 ORDER BY name ASC", [tenantId]);
    return result.rows.map(_shared_2.mapTenantDevice);
}
async function getTenantDeviceById(executor, tenantId, id) {
    (0, errors_1.assertTenantId)(tenantId);
    const result = await executor.query(`SELECT id, tenant_id, name, area, installation_location, gateway_id
     FROM tenant_devices
     WHERE tenant_id = $1 AND id = $2
     LIMIT 1`, [tenantId, id]);
    return result.rows[0] ?? null;
}
async function upsertTenantDevice(executor, tenantId, input) {
    (0, errors_1.assertTenantId)(tenantId);
    const id = input.id ?? (0, _shared_1.createId)("device");
    await executor.query(`
      INSERT INTO tenant_devices (id, tenant_id, name, type, area, installation_location, status, last_report_at, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        area = EXCLUDED.area,
        installation_location = EXCLUDED.installation_location,
        status = EXCLUDED.status,
        last_report_at = EXCLUDED.last_report_at,
        notes = EXCLUDED.notes
    `, [id, tenantId, input.name, input.type, input.area, input.installationLocation, input.status, input.lastReportAt, input.notes ?? ""]);
    const rowResult = await executor.query("SELECT * FROM tenant_devices WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
    const row = rowResult.rows[0];
    if (!row) {
        throw new Error("设备保存成功后未能读取到最新记录");
    }
    return (0, _shared_2.mapTenantDevice)(row);
}
async function deleteTenantDevice(executor, tenantId, id) {
    (0, errors_1.assertTenantId)(tenantId);
    await executor.query("DELETE FROM tenant_devices WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
}
async function upsertDeviceStatusSnapshot(executor, input) {
    (0, errors_1.assertTenantId)(input.tenantId);
    await executor.query(`
      INSERT INTO device_status_snapshots (
        device_id, tenant_id, gateway_id, status, last_event_type, last_event_code, last_reported_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (device_id) DO UPDATE SET
        gateway_id = COALESCE(EXCLUDED.gateway_id, device_status_snapshots.gateway_id),
        status = EXCLUDED.status,
        last_event_type = EXCLUDED.last_event_type,
        last_event_code = EXCLUDED.last_event_code,
        last_reported_at = EXCLUDED.last_reported_at,
        updated_at = EXCLUDED.updated_at
    `, [
        input.deviceId,
        input.tenantId,
        input.gatewayId ?? null,
        input.status,
        input.eventType,
        input.eventCode,
        input.reportedAt,
        input.reportedAt,
    ]);
}
async function updateTenantDeviceRuntime(executor, input) {
    (0, errors_1.assertTenantId)(input.tenantId);
    await executor.query("UPDATE tenant_devices SET status = $1, last_report_at = $2 WHERE tenant_id = $3 AND id = $4", [
        input.statusText,
        input.reportedAt,
        input.tenantId,
        input.deviceId,
    ]);
    await executor.query("UPDATE tenant_device_points SET status_style = $1, updated_at = $2 WHERE tenant_id = $3 AND device_id = $4", [input.pointStatusStyle, input.reportedAt, input.tenantId, input.deviceId]);
}
