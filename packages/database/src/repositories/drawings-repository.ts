import type { DbExecutor } from "../client";
import { queryDb } from "../client";
import { assertTenantId, EntityNotFoundError, RepositoryError } from "../errors";
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
    buildingId?: string;
    floorId?: string;
    name: string;
    fileUrl: string;
    fileType?: "image" | "pdf";
    sourceFileUrl?: string;
    previewUrl?: string;
    originalFileName?: string;
    fileSize?: number;
    processingStatus?: "processing" | "ready" | "failed";
    processingMessage?: string;
    conversionLog?: string[];
    sceneUrl?: string;
    width: number;
    height: number;
    version: string;
    status?: "draft" | "published" | "archived";
    publishedAt?: string;
    operatorName?: string;
    operatorRole?: string;
  },
) {
  assertTenantId(tenantId);
  const id = createId("drawing");
  const updatedAt = formatLocalTimestamp();
  const status = input.status ?? "published";
  const publishedAt = input.publishedAt ?? (status === "published" ? updatedAt : null);
  const sourceFileUrl = input.sourceFileUrl ?? input.fileUrl;
  const previewUrl = input.previewUrl ?? input.fileUrl;
  const sceneUrl = input.sceneUrl ?? previewUrl;

  return withTransaction(async (client) => {
    let buildingId = input.buildingId?.trim() ?? "";
    let floorId = input.floorId?.trim() ?? "";

    if (floorId) {
      const floor = await client.query("SELECT id, building_id FROM tenant_floors WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, floorId]);
      if (floor.rowCount === 0) {
        throw new EntityNotFoundError("floor", floorId);
      }
      buildingId = buildingId || String(floor.rows[0].building_id);
      if (String(floor.rows[0].building_id) !== buildingId) {
        throw new RepositoryError("DRAWING_TARGET_MISMATCH", "DRAWING_TARGET_MISMATCH");
      }
    }

    if (!buildingId) {
      throw new RepositoryError("buildingId is required", "VALIDATION_ERROR");
    }

    const area = await client.query("SELECT id, has_floors FROM tenant_buildings WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, buildingId]);
    if (area.rowCount === 0) {
      throw new EntityNotFoundError("spatial_area", buildingId);
    }
    if (area.rows[0].has_floors !== false && !floorId) {
      throw new RepositoryError("AREA_REQUIRES_FLOOR", "AREA_REQUIRES_FLOOR");
    }
    if (area.rows[0].has_floors === false) {
      floorId = "";
    }

    await client.query(
      `
        INSERT INTO tenant_drawings (
          id, tenant_id, building_id, floor_id, name, file_url, file_type, source_file_url, preview_url,
          original_file_name, file_size, processing_status, processing_message, conversion_log, scene_url,
          width, height, version, status, updated_at, published_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18,$19,$20,$21)
      `,
      [
        id,
        tenantId,
        buildingId,
        floorId,
        input.name,
        input.fileUrl,
        input.fileType ?? "image",
        sourceFileUrl,
        previewUrl,
        input.originalFileName ?? "",
        Number(input.fileSize ?? 0),
        input.processingStatus ?? "ready",
        input.processingMessage ?? "",
        JSON.stringify(input.conversionLog ?? []),
        sceneUrl,
        input.width,
        input.height,
        input.version,
        status,
        updatedAt,
        publishedAt,
      ],
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
      detail: `${buildingId}/${floorId || "area"} / ${input.name} / ${input.version}`,
      createdAt: updatedAt,
    });

    const row = await client.query("SELECT * FROM tenant_drawings WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, id]);
    return mapDrawing(row.rows[0]);
  });
}

export async function updateTenantDrawingStatus(
  tenantId: string,
  drawingId: string,
  status: "published" | "archived",
  input?: { operatorName?: string; operatorRole?: string },
) {
  assertTenantId(tenantId);
  const updatedAt = formatLocalTimestamp();
  return withTransaction(async (client) => {
    const drawing = await client.query("SELECT * FROM tenant_drawings WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, drawingId]);
    if (drawing.rowCount === 0) {
      throw new EntityNotFoundError("drawing", drawingId);
    }

    await client.query(
      `UPDATE tenant_drawings
       SET status = $1,
           updated_at = $2,
           published_at = CASE WHEN $1 = 'published' THEN $2 ELSE published_at END
       WHERE tenant_id = $3 AND id = $4`,
      [status, updatedAt, tenantId, drawingId],
    );

    await insertAuditLog(client, {
      id: createId("audit"),
      tenantId,
      actorScope: "tenant",
      actorName: input?.operatorName ?? "tenant_console",
      actorRole: input?.operatorRole ?? "tenant_console",
      action: status === "published" ? "drawing.publish" : "drawing.archive",
      targetType: "drawing",
      targetId: drawingId,
      result: "success",
      detail: String(drawing.rows[0].name ?? ""),
      createdAt: updatedAt,
    });

    const row = await client.query("SELECT * FROM tenant_drawings WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, drawingId]);
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
