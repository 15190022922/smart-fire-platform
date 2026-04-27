import { queryDb } from "../client";
import { assertTenantId, EntityNotFoundError } from "../errors";
import { withTransaction } from "../transaction";
import { insertAuditLog } from "./audit-repository";
import { createId, formatLocalTimestamp, mapDevicePoint } from "./_shared";

export async function listTenantDevicePoints(tenantId: string) {
  assertTenantId(tenantId);
  const rows = await queryDb("SELECT * FROM tenant_device_points WHERE tenant_id = $1 ORDER BY updated_at DESC", [tenantId]);
  return rows.rows.map(mapDevicePoint);
}

export async function upsertTenantDevicePoint(
  tenantId: string,
  input: {
    id?: string;
    deviceId: string;
    floorId: string;
    drawingId: string;
    x: number;
    y: number;
    rotation?: number;
    icon?: string;
    statusStyle?: "normal" | "alarm" | "fault" | "offline";
    operatorName?: string;
    operatorRole?: string;
  },
) {
  assertTenantId(tenantId);
  const updatedAt = formatLocalTimestamp();

  return withTransaction(async (client) => {
    const device = await client.query("SELECT id FROM tenant_devices WHERE tenant_id = $1 AND id = $2 LIMIT 1", [
      tenantId,
      input.deviceId,
    ]);
    const floor = await client.query("SELECT id FROM tenant_floors WHERE tenant_id = $1 AND id = $2 LIMIT 1", [
      tenantId,
      input.floorId,
    ]);
    const drawing = await client.query(
      "SELECT id, floor_id FROM tenant_drawings WHERE tenant_id = $1 AND id = $2 LIMIT 1",
      [tenantId, input.drawingId],
    );

    if (device.rowCount === 0) throw new EntityNotFoundError("device", input.deviceId);
    if (floor.rowCount === 0) throw new EntityNotFoundError("floor", input.floorId);
    if (drawing.rowCount === 0) throw new EntityNotFoundError("drawing", input.drawingId);
    if (String(drawing.rows[0].floor_id) !== input.floorId) {
      throw new Error("DRAWING_FLOOR_MISMATCH");
    }

    const existing = input.id
      ? await client.query("SELECT * FROM tenant_device_points WHERE id = $1 AND tenant_id = $2 LIMIT 1", [input.id, tenantId])
      : await client.query("SELECT * FROM tenant_device_points WHERE device_id = $1 AND tenant_id = $2 LIMIT 1", [input.deviceId, tenantId]);
    const id = existing.rows[0]?.id ?? createId("point");

    await client.query(
      `
        INSERT INTO tenant_device_points (id, tenant_id, device_id, floor_id, drawing_id, x, y, rotation, icon, status_style, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (id) DO UPDATE SET
          device_id = EXCLUDED.device_id,
          floor_id = EXCLUDED.floor_id,
          drawing_id = EXCLUDED.drawing_id,
          x = EXCLUDED.x,
          y = EXCLUDED.y,
          rotation = EXCLUDED.rotation,
          icon = EXCLUDED.icon,
          status_style = EXCLUDED.status_style,
          updated_at = EXCLUDED.updated_at
      `,
      [id, tenantId, input.deviceId, input.floorId, input.drawingId, input.x, input.y, input.rotation ?? 0, input.icon ?? "sensor", input.statusStyle ?? "normal", updatedAt],
    );

    await client.query("UPDATE tenant_devices SET floor_id = $1 WHERE tenant_id = $2 AND id = $3", [input.floorId, tenantId, input.deviceId]);

    await insertAuditLog(client, {
      id: createId("audit"),
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
    return mapDevicePoint(row.rows[0]);
  });
}

export async function deleteTenantDevicePoint(
  tenantId: string,
  pointId: string,
  input?: { operatorName?: string; operatorRole?: string },
) {
  assertTenantId(tenantId);
  const updatedAt = formatLocalTimestamp();
  return withTransaction(async (client) => {
    const point = await client.query("SELECT * FROM tenant_device_points WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, pointId]);
    if (point.rowCount === 0) {
      throw new EntityNotFoundError("device_point", pointId);
    }

    await client.query("DELETE FROM tenant_device_points WHERE tenant_id = $1 AND id = $2", [tenantId, pointId]);
    await insertAuditLog(client, {
      id: createId("audit"),
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
