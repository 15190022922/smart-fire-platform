import type { DbExecutor } from "../client";
import { queryDb } from "../client";
import { assertTenantId } from "../errors";
import type { DeviceLifecycleAction, DeviceLifecycleFilter, DeviceLifecyclePreview, DeviceLifecyclePreviewItem } from "../../../../types/saas";
import { createId, formatLocalTimestamp, mapRuntimeStatus, mapTenantDevice } from "./_shared";
import { ensureCoreDeviceAttributeDefinitions } from "./device-attributes-repository";

function runtimeStatusFromDeviceStatus(status: string) {
  if (status === "报警") return "alarm";
  if (status === "故障") return "fault";
  if (status === "离线") return "offline";
  if (status === "维保中" || status === "维修中") return "maintenance";
  return "normal";
}

function normalizeLifecycleFilter(value?: string): DeviceLifecycleFilter {
  if (value === "disabled" || value === "all") return value;
  return "active";
}

function normalizeLifecycleAction(value?: string): DeviceLifecycleAction {
  return value === "restore" ? "restore" : "disable";
}

function normalizeDeviceIds(input: unknown) {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.map((item) => String(item ?? "").trim()).filter(Boolean)));
}

async function countByDevice(executor: DbExecutor, sql: string, params: unknown[]) {
  const result = await executor.query(sql, params);
  return new Map(result.rows.map((row) => [String(row.device_id), Number(row.count ?? 0)]));
}

export async function listTenantDevices(tenantId: string, lifecycle?: DeviceLifecycleFilter) {
  assertTenantId(tenantId);
  const filter = normalizeLifecycleFilter(lifecycle);
  const result =
    filter === "all"
      ? await queryDb("SELECT * FROM tenant_devices WHERE tenant_id = $1 ORDER BY name ASC", [tenantId])
      : await queryDb(
          "SELECT * FROM tenant_devices WHERE tenant_id = $1 AND COALESCE(lifecycle_status, 'active') = $2 ORDER BY name ASC",
          [tenantId, filter],
        );
  return result.rows.map(mapTenantDevice);
}

export async function getTenantDeviceById(executor: DbExecutor, tenantId: string, id: string) {
  assertTenantId(tenantId);
  const result = await executor.query(
    `SELECT id, tenant_id, name, area, installation_location, gateway_id, lifecycle_status, disabled_at, disabled_reason
     FROM tenant_devices
     WHERE tenant_id = $1 AND id = $2
     LIMIT 1`,
    [tenantId, id],
  );
  return result.rows[0] ?? null;
}

export async function upsertTenantDevice(executor: DbExecutor, tenantId: string, input: any) {
  assertTenantId(tenantId);
  await ensureCoreDeviceAttributeDefinitions(executor, tenantId);
  const deviceCode = String(input.deviceCode ?? "").trim();
  const id = input.id ?? (deviceCode ? await findTenantDeviceIdByCode(executor, tenantId, deviceCode) : null) ?? createId("device");
  const reportedAt = input.lastReportAt || formatLocalTimestamp();
  const runtime = runtimeStatusFromDeviceStatus(input.status);
  const mapped = mapRuntimeStatus(runtime);
  const customAttributes =
    input.customAttributes && typeof input.customAttributes === "object" && !Array.isArray(input.customAttributes)
      ? input.customAttributes
      : {};

  await executor.query(
    `
      INSERT INTO tenant_devices (
        id, tenant_id, device_code, name, type, area, installation_location, status, installation_status,
        last_report_at, notes, custom_attributes
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (id) DO UPDATE SET
        device_code = EXCLUDED.device_code,
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        area = EXCLUDED.area,
        installation_location = EXCLUDED.installation_location,
        status = EXCLUDED.status,
        installation_status = EXCLUDED.installation_status,
        last_report_at = EXCLUDED.last_report_at,
        notes = EXCLUDED.notes,
        custom_attributes = EXCLUDED.custom_attributes
    `,
    [
      id,
      tenantId,
      deviceCode,
      input.name,
      input.type,
      input.area,
      input.installationLocation,
      input.status,
      input.installationStatus ?? "",
      reportedAt,
      input.notes ?? "",
      JSON.stringify(customAttributes),
    ],
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

export async function findTenantDeviceIdByCode(executor: DbExecutor, tenantId: string, deviceCode: string) {
  assertTenantId(tenantId);
  const result = await executor.query("SELECT id FROM tenant_devices WHERE tenant_id = $1 AND device_code = $2 LIMIT 1", [
    tenantId,
    deviceCode,
  ]);
  return result.rows[0]?.id as string | undefined;
}

export async function previewTenantDeviceLifecycle(
  executor: DbExecutor,
  tenantId: string,
  input: { deviceIds?: unknown; action?: string },
): Promise<DeviceLifecyclePreview> {
  assertTenantId(tenantId);
  const action = normalizeLifecycleAction(input.action);
  const deviceIds = normalizeDeviceIds(input.deviceIds);
  if (deviceIds.length === 0) {
    return {
      action,
      total: 0,
      updateable: 0,
      skipped: 0,
      missing: 0,
      pointCount: 0,
      openAlarmCount: 0,
      rawEventCount: 0,
      maintenanceRecordCount: 0,
      devices: [],
    };
  }

  const deviceRows = await executor.query(
    `
      SELECT id, device_code, name, lifecycle_status
      FROM tenant_devices
      WHERE tenant_id = $1 AND id = ANY($2::text[])
    `,
    [tenantId, deviceIds],
  );
  const foundIds = new Set(deviceRows.rows.map((row) => String(row.id)));
  const pointCounts = await countByDevice(
    executor,
    "SELECT device_id, COUNT(*)::int AS count FROM tenant_device_points WHERE tenant_id = $1 AND device_id = ANY($2::text[]) GROUP BY device_id",
    [tenantId, deviceIds],
  );
  const openAlarmCounts = await countByDevice(
    executor,
    `
      SELECT device_id, COUNT(*)::int AS count
      FROM tenant_alarms
      WHERE tenant_id = $1
        AND device_id = ANY($2::text[])
        AND COALESCE(workflow_status, '') NOT IN ('已完成', '已关闭')
        AND COALESCE(process_status, '') <> '已处理'
      GROUP BY device_id
    `,
    [tenantId, deviceIds],
  );
  const rawEventCounts = await countByDevice(
    executor,
    "SELECT device_id, COUNT(*)::int AS count FROM raw_device_events WHERE tenant_id = $1 AND device_id = ANY($2::text[]) GROUP BY device_id",
    [tenantId, deviceIds],
  );
  const maintenanceCounts = await countByDevice(
    executor,
    "SELECT device_id, COUNT(*)::int AS count FROM maintenance_records WHERE tenant_id = $1 AND device_id = ANY($2::text[]) GROUP BY device_id",
    [tenantId, deviceIds],
  );

  const devices: DeviceLifecyclePreviewItem[] = deviceRows.rows.map((row) => {
    const lifecycleStatus = String(row.lifecycle_status || "active") === "disabled" ? "disabled" : "active";
    const canUpdate = action === "disable" ? lifecycleStatus !== "disabled" : lifecycleStatus === "disabled";
    return {
      deviceId: String(row.id),
      deviceCode: String(row.device_code ?? ""),
      name: String(row.name ?? ""),
      lifecycleStatus,
      pointCount: pointCounts.get(String(row.id)) ?? 0,
      openAlarmCount: openAlarmCounts.get(String(row.id)) ?? 0,
      rawEventCount: rawEventCounts.get(String(row.id)) ?? 0,
      maintenanceRecordCount: maintenanceCounts.get(String(row.id)) ?? 0,
      canUpdate,
      message: canUpdate ? "可操作" : action === "disable" ? "设备已停用" : "设备未停用",
    };
  });
  const missing = deviceIds.length - foundIds.size;
  const updateable = devices.filter((item) => item.canUpdate).length;

  return {
    action,
    total: deviceIds.length,
    updateable,
    skipped: devices.length - updateable,
    missing,
    pointCount: devices.reduce((sum, item) => sum + item.pointCount, 0),
    openAlarmCount: devices.reduce((sum, item) => sum + item.openAlarmCount, 0),
    rawEventCount: devices.reduce((sum, item) => sum + item.rawEventCount, 0),
    maintenanceRecordCount: devices.reduce((sum, item) => sum + item.maintenanceRecordCount, 0),
    devices,
  };
}

export async function updateTenantDeviceLifecycle(
  executor: DbExecutor,
  tenantId: string,
  input: { deviceIds?: unknown; action?: string; reason?: string },
) {
  assertTenantId(tenantId);
  const action = normalizeLifecycleAction(input.action);
  const reason = String(input.reason ?? "").trim();
  const preview = await previewTenantDeviceLifecycle(executor, tenantId, { deviceIds: input.deviceIds, action });
  const updateIds = preview.devices.filter((item) => item.canUpdate).map((item) => item.deviceId);
  const updatedIds = new Set<string>();

  if (updateIds.length > 0) {
    const now = formatLocalTimestamp();
    const result =
      action === "disable"
        ? await executor.query(
            `
              UPDATE tenant_devices
              SET lifecycle_status = 'disabled', disabled_at = $3, disabled_reason = $4
              WHERE tenant_id = $1 AND id = ANY($2::text[]) AND COALESCE(lifecycle_status, 'active') <> 'disabled'
              RETURNING id
            `,
            [tenantId, updateIds, now, reason],
          )
        : await executor.query(
            `
              UPDATE tenant_devices
              SET lifecycle_status = 'active', disabled_at = NULL, disabled_reason = ''
              WHERE tenant_id = $1 AND id = ANY($2::text[]) AND COALESCE(lifecycle_status, 'active') = 'disabled'
              RETURNING id
            `,
            [tenantId, updateIds],
          );
    for (const row of result.rows) {
      updatedIds.add(String(row.id));
    }
  }

  return {
    ...preview,
    updated: updatedIds.size,
    failed: preview.missing,
    results: [
      ...preview.devices.map((item) => ({
        deviceId: item.deviceId,
        status: updatedIds.has(item.deviceId) ? ("updated" as const) : ("skipped" as const),
        message: updatedIds.has(item.deviceId) ? (action === "disable" ? "已停用" : "已恢复") : item.message,
      })),
      ...normalizeDeviceIds(input.deviceIds)
        .filter((id) => !preview.devices.some((item) => item.deviceId === id))
        .map((deviceId) => ({ deviceId, status: "failed" as const, message: "设备不存在" })),
    ],
  };
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
