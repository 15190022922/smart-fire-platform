"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTenantDrawings = listTenantDrawings;
exports.createTenantDrawing = createTenantDrawing;
exports.deleteTenantDrawing = deleteTenantDrawing;
const client_1 = require("../client");
const errors_1 = require("../errors");
const transaction_1 = require("../transaction");
const audit_repository_1 = require("./audit-repository");
const _shared_1 = require("./_shared");
async function listTenantDrawings(tenantId) {
    (0, errors_1.assertTenantId)(tenantId);
    const rows = await (0, client_1.queryDb)("SELECT * FROM tenant_drawings WHERE tenant_id = $1 ORDER BY updated_at DESC", [tenantId]);
    return rows.rows.map(_shared_1.mapDrawing);
}
async function createTenantDrawing(tenantId, input) {
    (0, errors_1.assertTenantId)(tenantId);
    const id = (0, _shared_1.createId)("drawing");
    const updatedAt = (0, _shared_1.formatLocalTimestamp)();
    return (0, transaction_1.withTransaction)(async (client) => {
        const floor = await client.query("SELECT id FROM tenant_floors WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, input.floorId]);
        if (floor.rowCount === 0) {
            throw new errors_1.EntityNotFoundError("floor", input.floorId);
        }
        await client.query(`
        INSERT INTO tenant_drawings (id, tenant_id, floor_id, name, file_url, width, height, version, status, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `, [id, tenantId, input.floorId, input.name, input.fileUrl, input.width, input.height, input.version, input.status ?? "published", updatedAt]);
        await (0, audit_repository_1.insertAuditLog)(client, {
            id: (0, _shared_1.createId)("audit"),
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
        return (0, _shared_1.mapDrawing)(row.rows[0]);
    });
}
async function deleteTenantDrawing(tenantId, drawingId, input) {
    (0, errors_1.assertTenantId)(tenantId);
    const deletedAt = (0, _shared_1.formatLocalTimestamp)();
    return (0, transaction_1.withTransaction)(async (client) => {
        const drawing = await client.query("SELECT * FROM tenant_drawings WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, drawingId]);
        if (drawing.rowCount === 0) {
            throw new errors_1.EntityNotFoundError("drawing", drawingId);
        }
        const deletedPoints = await client.query("DELETE FROM tenant_device_points WHERE tenant_id = $1 AND drawing_id = $2 RETURNING id", [tenantId, drawingId]);
        await client.query("DELETE FROM tenant_drawings WHERE tenant_id = $1 AND id = $2", [tenantId, drawingId]);
        await (0, audit_repository_1.insertAuditLog)(client, {
            id: (0, _shared_1.createId)("audit"),
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
