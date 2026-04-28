import type { DbExecutor } from "../client";
import { queryDb } from "../client";
import { assertTenantId } from "../errors";
import { createId, formatLocalTimestamp, mapRuntimeStatus, mapTenantDevice } from "./_shared";

function runtimeStatusFromDeviceStatus(status: string) {
  if (status === "报警") return "alarm";
  if (status === "故障") return "fault";
  if (status === "离线") return "offline";
  if (status === "维保中" || status === "维修中") return "maintenance";
  return "normal";
}

export async function listTenantDevices(tenantId: string) {
  assertTenantId(tenantId);
  const result = await queryDb("SELECT * FROM tenant_devices WHERE tenant_id = $1 ORDER BY name ASC", [tenantId]);
  return result.rows.map(mapTenantDevice);
}

export async function getTenantDeviceById(executor: DbExecutor, tenantId: string, id: string) {
  assertTenantId(tenantId);
  const result = await executor.query(
    `SELECT id, tenant_id, name, area, installation_location, gateway_id
     FROM tenant_devices
     WHERE tenant_id = $1 AND id = $2
     LIMIT 1`,
    [tenantId, id],
  );
  return result.rows[0] ?? null;
}

export async function upsertTenantDevice(executor: DbExecutor, tenantId: string, input: any) {
  assertTenantId(tenantId);
  const id = input.id ?? createId("device");
  const reportedAt = input.lastReportAt || formatLocalTimestamp();
  const runtime = runtimeStatusFromDeviceStatus(input.status);
  const mapped = mapRuntimeStatus(runtime);

  await executor.query(
    `
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
    `,
    [id, tenantId, input.name, input.type, input.area, input.installationLocation, input.status, reportedAt, input.notes ?? ""],
  );

  await executor.query(
    `
      INSERT INTO device_status_snapshots (
        device_id, tenant_id, gateway_id, status, last_event_type, last_event_code, last_reported_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (device_id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        status = EXCLUDED.status,
        last_event_type = EXCLUDED.last_event_type,
        last_event_code = EXCLUDED.last_event_code,
        last_reported_at = EXCLUDED.last_reported_at,
        updated_at = EXCLUDED.updated_at
    `,
    [id, tenantId, input.gatewayId ?? null, runtime, "manual_update", "DEVICE_MANUAL_UPDATE", reportedAt, reportedAt],
  );

  await executor.query(
    "UPDATE tenant_device_points SET status_style = $1, updated_at = $2 WHERE tenant_id = $3 AND device_id = $4",
    [mapped.pointStatusStyle, reportedAt, tenantId, id],
  );

  const rowResult = await executor.query("SELECT * FROM tenant_devices WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
  const row = rowResult.rows[0];
  if (!row) {
    throw new Error("设备保存成功后未能读取到最新记录");
  }
  return mapTenantDevice(row);
}

export async function deleteTenantDevice(executor: DbExecutor, tenantId: string, id: string) {
  assertTenantId(tenantId);
  await executor.query("DELETE FROM tenant_device_points WHERE device_id = $1 AND tenant_id = $2", [id, tenantId]);
  await executor.query("DELETE FROM device_status_snapshots WHERE device_id = $1 AND tenant_id = $2", [id, tenantId]);
  await executor.query("DELETE FROM tenant_devices WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
}

export async function upsertDeviceStatusSnapshot(
  executor: DbExecutor,
  input: {
    deviceId: string;
    tenantId: string;
    gatewayId?: string | null;
    status: string;
    eventType: string;
    eventCode: string;
    reportedAt: string;
  },
) {
  assertTenantId(input.tenantId);
  await executor.query(
    `
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
    `,
    [
      input.deviceId,
      input.tenantId,
      input.gatewayId ?? null,
      input.status,
      input.eventType,
      input.eventCode,
      input.reportedAt,
      input.reportedAt,
    ],
  );
}

export async function updateTenantDeviceRuntime(
  executor: DbExecutor,
  input: {
    tenantId: string;
    deviceId: string;
    statusText: string;
    pointStatusStyle: string;
    reportedAt: string;
  },
) {
  assertTenantId(input.tenantId);
  await executor.query("UPDATE tenant_devices SET status = $1, last_report_at = $2 WHERE tenant_id = $3 AND id = $4", [
    input.statusText,
    input.reportedAt,
    input.tenantId,
    input.deviceId,
  ]);

  await executor.query(
    "UPDATE tenant_device_points SET status_style = $1, updated_at = $2 WHERE tenant_id = $3 AND device_id = $4",
    [input.pointStatusStyle, input.reportedAt, input.tenantId, input.deviceId],
  );
}
