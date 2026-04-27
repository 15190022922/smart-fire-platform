import type { DbExecutor } from "../client";
import { queryDb } from "../client";
import { assertTenantId, EntityNotFoundError } from "../errors";
import { withTransaction } from "../transaction";
import { insertAuditLog } from "./audit-repository";
import { createId, formatLocalTimestamp, mapDrawing } from "./_shared";

export async function listTenantDrawings(tenantId: string) {
  assertTenantId(tenantId);
  const rows = await queryDb("SELECT * FROM tenant_drawings WHERE tenant_id = $1 ORDER BY updated_at DESC", [tenantId]);
  return rows.rows.map(mapDrawing);
}

export async function createTenantDrawing(
  tenantId: string,
  input: {
    floorId: string;
    name: string;
    fileUrl: string;
    width: number;
    height: number;
    version: string;
    status?: "draft" | "published" | "archived";
    operatorName?: string;
    operatorRole?: string;
  },
) {
  assertTenantId(tenantId);
  const id = createId("drawing");
  const updatedAt = formatLocalTimestamp();

  return withTransaction(async (client) => {
    const floor = await client.query("SELECT id FROM tenant_floors WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, input.floorId]);
    if (floor.rowCount === 0) {
      throw new EntityNotFoundError("floor", input.floorId);
    }

    await client.query(
      `
        INSERT INTO tenant_drawings (id, tenant_id, floor_id, name, file_url, width, height, version, status, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `,
      [id, tenantId, input.floorId, input.name, input.fileUrl, input.width, input.height, input.version, input.status ?? "published", updatedAt],
    );

    await insertAuditLog(client, {
      id: createId("audit"),
      tenantId,
      actorScope: "tenant",
      actorName: input.operatorName ?? "tenant_console",
      actorRole: input.operatorRole ?? "tenant_console",
      action: "drawing.create",
      targetType: "drawing",
      targetId: id,
      result: "success",
      detail: `${input.floorId} / ${input.name} / ${input.version}`,
      createdAt: updatedAt,
    });

    const row = await client.query("SELECT * FROM tenant_drawings WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, id]);
    return mapDrawing(row.rows[0]);
  });
}

export async function deleteTenantDrawing(
  tenantId: string,
  drawingId: string,
  input?: { operatorName?: string; operatorRole?: string },
) {
  assertTenantId(tenantId);
  const deletedAt = formatLocalTimestamp();
  return withTransaction(async (client) => {
    const drawing = await client.query("SELECT * FROM tenant_drawings WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, drawingId]);
    if (drawing.rowCount === 0) {
      throw new EntityNotFoundError("drawing", drawingId);
    }

    const deletedPoints = await client.query("DELETE FROM tenant_device_points WHERE tenant_id = $1 AND drawing_id = $2 RETURNING id", [tenantId, drawingId]);
    await client.query("DELETE FROM tenant_drawings WHERE tenant_id = $1 AND id = $2", [tenantId, drawingId]);

    await insertAuditLog(client, {
      id: createId("audit"),
      tenantId,
      actorScope: "tenant",
      actorName: input?.operatorName ?? "tenant_console",
      actorRole: input?.operatorRole ?? "tenant_console",
      action: "drawing.delete",
      targetType: "drawing",
      targetId: drawingId,
      result: "success",
      detail: `cascade_points=${deletedPoints.rowCount ?? 0}`,
      createdAt: deletedAt,
    });

    return { success: true, deletedPointCount: deletedPoints.rowCount ?? 0 };
  });
}
