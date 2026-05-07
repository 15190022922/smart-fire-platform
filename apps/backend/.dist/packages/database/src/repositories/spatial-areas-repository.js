"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTenantSpatialArea = createTenantSpatialArea;
exports.updateTenantSpatialArea = updateTenantSpatialArea;
exports.deleteTenantSpatialArea = deleteTenantSpatialArea;
exports.createTenantFloor = createTenantFloor;
exports.updateTenantFloor = updateTenantFloor;
exports.deleteTenantFloor = deleteTenantFloor;
const errors_1 = require("../errors");
const transaction_1 = require("../transaction");
const audit_repository_1 = require("./audit-repository");
const _shared_1 = require("./_shared");
function normalizeStatus(value) {
    return value === "inactive" ? "inactive" : "active";
}
async function resolveSiteId(client, tenantId, siteId) {
    if (siteId?.trim()) {
        const site = await client.query("SELECT id FROM tenant_sites WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, siteId.trim()]);
        if (site.rowCount === 0)
            throw new errors_1.EntityNotFoundError("site", siteId);
        return siteId.trim();
    }
    const firstSite = await client.query("SELECT id FROM tenant_sites WHERE tenant_id = $1 ORDER BY name ASC LIMIT 1", [tenantId]);
    if (firstSite.rowCount === 0)
        throw new errors_1.EntityNotFoundError("site", "default");
    return String(firstSite.rows[0].id);
}
function normalizeFloorInput(input, fallbackOrder) {
    const name = input.name.trim();
    if (!name)
        throw new errors_1.RepositoryError("floor name is required", "VALIDATION_ERROR");
    const levelIndex = Number(input.levelIndex ?? fallbackOrder);
    return {
        id: input.id?.trim() || "",
        name,
        code: input.code?.trim() || "",
        levelIndex,
        sortOrder: Number(input.sortOrder ?? levelIndex),
        status: normalizeStatus(input.status),
        description: input.description?.trim() || "",
    };
}
async function insertFloorInArea(client, tenantId, buildingId, input, fallbackOrder, audit) {
    const floor = normalizeFloorInput(input, fallbackOrder);
    const id = (0, _shared_1.createId)("floor");
    const createdAt = (0, _shared_1.formatLocalTimestamp)();
    await client.query(`
      INSERT INTO tenant_floors (id, tenant_id, building_id, name, code, level_index, sort_order, status, description)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `, [
        id,
        tenantId,
        buildingId,
        floor.name,
        floor.code || id,
        floor.levelIndex,
        floor.sortOrder,
        floor.status,
        floor.description,
    ]);
    await (0, audit_repository_1.insertAuditLog)(client, {
        id: (0, _shared_1.createId)("audit"),
        tenantId,
        actorScope: "tenant",
        actorName: audit.operatorName ?? "tenant_console",
        actorRole: audit.operatorRole ?? "tenant_console",
        action: "floor.create",
        targetType: "floor",
        targetId: id,
        result: "success",
        detail: `${buildingId} / ${floor.name}`,
        createdAt,
    });
    return id;
}
async function updateFloorInArea(client, tenantId, buildingId, input, fallbackOrder, audit) {
    const floor = normalizeFloorInput(input, fallbackOrder);
    if (!floor.id)
        throw new errors_1.RepositoryError("floor id is required", "VALIDATION_ERROR");
    const existing = await client.query("SELECT * FROM tenant_floors WHERE tenant_id = $1 AND building_id = $2 AND id = $3 LIMIT 1", [
        tenantId,
        buildingId,
        floor.id,
    ]);
    if (existing.rowCount === 0)
        throw new errors_1.EntityNotFoundError("floor", floor.id);
    await client.query(`
      UPDATE tenant_floors
      SET name = $1,
          code = $2,
          level_index = $3,
          sort_order = $4,
          status = $5,
          description = $6
      WHERE tenant_id = $7 AND building_id = $8 AND id = $9
    `, [
        floor.name,
        floor.code || existing.rows[0].code,
        floor.levelIndex,
        floor.sortOrder,
        floor.status,
        floor.description,
        tenantId,
        buildingId,
        floor.id,
    ]);
    await (0, audit_repository_1.insertAuditLog)(client, {
        id: (0, _shared_1.createId)("audit"),
        tenantId,
        actorScope: "tenant",
        actorName: audit.operatorName ?? "tenant_console",
        actorRole: audit.operatorRole ?? "tenant_console",
        action: "floor.update",
        targetType: "floor",
        targetId: floor.id,
        result: "success",
        detail: floor.name,
        createdAt: (0, _shared_1.formatLocalTimestamp)(),
    });
}
async function deleteFloorInArea(client, tenantId, buildingId, floorId, audit) {
    const floor = await client.query("SELECT * FROM tenant_floors WHERE tenant_id = $1 AND building_id = $2 AND id = $3 LIMIT 1", [
        tenantId,
        buildingId,
        floorId,
    ]);
    if (floor.rowCount === 0)
        throw new errors_1.EntityNotFoundError("floor", floorId);
    const drawings = await client.query("SELECT id FROM tenant_drawings WHERE tenant_id = $1 AND floor_id = $2 LIMIT 1", [tenantId, floorId]);
    const points = await client.query("SELECT id FROM tenant_device_points WHERE tenant_id = $1 AND floor_id = $2 LIMIT 1", [tenantId, floorId]);
    if ((drawings.rowCount ?? 0) > 0 || (points.rowCount ?? 0) > 0) {
        throw new errors_1.RepositoryError("FLOOR_HAS_LINKED_DATA", "FLOOR_HAS_LINKED_DATA");
    }
    await client.query("DELETE FROM tenant_floors WHERE tenant_id = $1 AND building_id = $2 AND id = $3", [tenantId, buildingId, floorId]);
    await (0, audit_repository_1.insertAuditLog)(client, {
        id: (0, _shared_1.createId)("audit"),
        tenantId,
        actorScope: "tenant",
        actorName: audit.operatorName ?? "tenant_console",
        actorRole: audit.operatorRole ?? "tenant_console",
        action: "floor.delete",
        targetType: "floor",
        targetId: floorId,
        result: "success",
        detail: String(floor.rows[0].name ?? ""),
        createdAt: (0, _shared_1.formatLocalTimestamp)(),
    });
}
async function syncAreaLevelCount(client, tenantId, buildingId) {
    await client.query("UPDATE tenant_buildings SET level_count = CASE WHEN has_floors = FALSE THEN 0 ELSE (SELECT COUNT(*) FROM tenant_floors WHERE tenant_id = $1 AND building_id = $2) END WHERE tenant_id = $1 AND id = $2", [tenantId, buildingId]);
}
async function listAreaFloors(client, tenantId, buildingId) {
    const floors = await client.query("SELECT * FROM tenant_floors WHERE tenant_id = $1 AND building_id = $2 ORDER BY sort_order ASC, level_index ASC, name ASC", [tenantId, buildingId]);
    return floors.rows.map(_shared_1.mapFloor);
}
async function createTenantSpatialArea(tenantId, input) {
    (0, errors_1.assertTenantId)(tenantId);
    const id = (0, _shared_1.createId)("area");
    const createdAt = (0, _shared_1.formatLocalTimestamp)();
    const name = input.name.trim();
    if (!name)
        throw new errors_1.RepositoryError("area name is required", "VALIDATION_ERROR");
    const hasFloors = input.hasFloors !== false;
    const floorInputs = hasFloors && Array.isArray(input.floors) ? input.floors : [];
    return (0, transaction_1.withTransaction)(async (client) => {
        const siteId = await resolveSiteId(client, tenantId, input.siteId);
        await client.query(`
        INSERT INTO tenant_buildings (
          id, tenant_id, site_id, name, code, level_count, usage_type,
          area_type, has_floors, sort_order, status, description
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `, [
            id,
            tenantId,
            siteId,
            name,
            input.code?.trim() || id,
            hasFloors ? floorInputs.length : 0,
            input.areaType?.trim() || "building",
            input.areaType?.trim() || "building",
            hasFloors,
            Number(input.sortOrder ?? 0),
            normalizeStatus(input.status),
            input.description?.trim() || "",
        ]);
        await (0, audit_repository_1.insertAuditLog)(client, {
            id: (0, _shared_1.createId)("audit"),
            tenantId,
            actorScope: "tenant",
            actorName: input.operatorName ?? "tenant_console",
            actorRole: input.operatorRole ?? "tenant_console",
            action: "spatial_area.create",
            targetType: "spatial_area",
            targetId: id,
            result: "success",
            detail: name,
            createdAt,
        });
        if (hasFloors) {
            for (const [index, floor] of floorInputs.entries()) {
                await insertFloorInArea(client, tenantId, id, floor, index + 1, input);
            }
            await syncAreaLevelCount(client, tenantId, id);
        }
        const row = await client.query("SELECT * FROM tenant_buildings WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, id]);
        return { area: (0, _shared_1.mapBuilding)(row.rows[0]), floors: await listAreaFloors(client, tenantId, id) };
    });
}
async function updateTenantSpatialArea(tenantId, areaId, input) {
    (0, errors_1.assertTenantId)(tenantId);
    const updatedAt = (0, _shared_1.formatLocalTimestamp)();
    return (0, transaction_1.withTransaction)(async (client) => {
        const existing = await client.query("SELECT * FROM tenant_buildings WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, areaId]);
        if (existing.rowCount === 0)
            throw new errors_1.EntityNotFoundError("spatial_area", areaId);
        const nextHasFloors = input.hasFloors ?? existing.rows[0].has_floors !== false;
        const siteId = input.siteId ? await resolveSiteId(client, tenantId, input.siteId) : existing.rows[0].site_id;
        const name = input.name?.trim() || existing.rows[0].name;
        const areaType = input.areaType?.trim() || existing.rows[0].area_type || existing.rows[0].usage_type || "building";
        await client.query(`
        UPDATE tenant_buildings
        SET site_id = $1,
            name = $2,
            code = $3,
            level_count = $4,
            usage_type = $5,
            area_type = $6,
            has_floors = $7,
            sort_order = $8,
            status = $9,
            description = $10
        WHERE tenant_id = $11 AND id = $12
      `, [
            siteId,
            name,
            input.code?.trim() || existing.rows[0].code,
            nextHasFloors ? existing.rows[0].level_count || 1 : 0,
            areaType,
            areaType,
            nextHasFloors,
            Number(input.sortOrder ?? existing.rows[0].sort_order ?? 0),
            normalizeStatus(input.status ?? existing.rows[0].status),
            input.description?.trim() ?? existing.rows[0].description ?? "",
            tenantId,
            areaId,
        ]);
        const deletedFloorIds = Array.isArray(input.deletedFloorIds)
            ? Array.from(new Set(input.deletedFloorIds.map((id) => id.trim()).filter(Boolean)))
            : [];
        for (const floorId of deletedFloorIds) {
            await deleteFloorInArea(client, tenantId, areaId, floorId, input);
        }
        if (nextHasFloors && Array.isArray(input.floors)) {
            for (const [index, floor] of input.floors.entries()) {
                if (floor.id?.trim()) {
                    await updateFloorInArea(client, tenantId, areaId, floor, index + 1, input);
                }
                else {
                    await insertFloorInArea(client, tenantId, areaId, floor, index + 1, input);
                }
            }
        }
        if (!nextHasFloors) {
            const linkedFloors = await client.query("SELECT id FROM tenant_floors WHERE tenant_id = $1 AND building_id = $2 LIMIT 1", [tenantId, areaId]);
            if ((linkedFloors.rowCount ?? 0) > 0) {
                throw new errors_1.RepositoryError("AREA_HAS_FLOORS", "AREA_HAS_FLOORS");
            }
        }
        await syncAreaLevelCount(client, tenantId, areaId);
        await (0, audit_repository_1.insertAuditLog)(client, {
            id: (0, _shared_1.createId)("audit"),
            tenantId,
            actorScope: "tenant",
            actorName: input.operatorName ?? "tenant_console",
            actorRole: input.operatorRole ?? "tenant_console",
            action: "spatial_area.update",
            targetType: "spatial_area",
            targetId: areaId,
            result: "success",
            detail: name,
            createdAt: updatedAt,
        });
        const row = await client.query("SELECT * FROM tenant_buildings WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, areaId]);
        return { area: (0, _shared_1.mapBuilding)(row.rows[0]), floors: await listAreaFloors(client, tenantId, areaId) };
    });
}
async function deleteTenantSpatialArea(tenantId, areaId, input) {
    (0, errors_1.assertTenantId)(tenantId);
    const deletedAt = (0, _shared_1.formatLocalTimestamp)();
    return (0, transaction_1.withTransaction)(async (client) => {
        const area = await client.query("SELECT * FROM tenant_buildings WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, areaId]);
        if (area.rowCount === 0)
            throw new errors_1.EntityNotFoundError("spatial_area", areaId);
        const floors = await client.query("SELECT id FROM tenant_floors WHERE tenant_id = $1 AND building_id = $2 LIMIT 1", [tenantId, areaId]);
        const drawings = await client.query("SELECT id FROM tenant_drawings WHERE tenant_id = $1 AND building_id = $2 LIMIT 1", [tenantId, areaId]);
        const points = await client.query("SELECT id FROM tenant_device_points WHERE tenant_id = $1 AND building_id = $2 LIMIT 1", [tenantId, areaId]);
        if ((floors.rowCount ?? 0) > 0 || (drawings.rowCount ?? 0) > 0 || (points.rowCount ?? 0) > 0) {
            throw new errors_1.RepositoryError("AREA_HAS_LINKED_DATA", "AREA_HAS_LINKED_DATA");
        }
        await client.query("DELETE FROM tenant_buildings WHERE tenant_id = $1 AND id = $2", [tenantId, areaId]);
        await (0, audit_repository_1.insertAuditLog)(client, {
            id: (0, _shared_1.createId)("audit"),
            tenantId,
            actorScope: "tenant",
            actorName: input?.operatorName ?? "tenant_console",
            actorRole: input?.operatorRole ?? "tenant_console",
            action: "spatial_area.delete",
            targetType: "spatial_area",
            targetId: areaId,
            result: "success",
            detail: String(area.rows[0].name ?? ""),
            createdAt: deletedAt,
        });
        return { success: true };
    });
}
async function createTenantFloor(tenantId, input) {
    (0, errors_1.assertTenantId)(tenantId);
    const id = (0, _shared_1.createId)("floor");
    const createdAt = (0, _shared_1.formatLocalTimestamp)();
    const name = input.name.trim();
    if (!name)
        throw new errors_1.RepositoryError("floor name is required", "VALIDATION_ERROR");
    return (0, transaction_1.withTransaction)(async (client) => {
        const area = await client.query("SELECT * FROM tenant_buildings WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, input.buildingId]);
        if (area.rowCount === 0)
            throw new errors_1.EntityNotFoundError("spatial_area", input.buildingId);
        if (area.rows[0].has_floors === false)
            throw new errors_1.RepositoryError("AREA_HAS_NO_FLOORS", "AREA_HAS_NO_FLOORS");
        await client.query(`
        INSERT INTO tenant_floors (id, tenant_id, building_id, name, code, level_index, sort_order, status, description)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `, [
            id,
            tenantId,
            input.buildingId,
            name,
            input.code?.trim() || id,
            Number(input.levelIndex ?? 1),
            Number(input.sortOrder ?? input.levelIndex ?? 1),
            normalizeStatus(input.status),
            input.description?.trim() || "",
        ]);
        await client.query("UPDATE tenant_buildings SET level_count = GREATEST(level_count, (SELECT COUNT(*) FROM tenant_floors WHERE tenant_id = $1 AND building_id = $2)) WHERE tenant_id = $1 AND id = $2", [tenantId, input.buildingId]);
        await (0, audit_repository_1.insertAuditLog)(client, {
            id: (0, _shared_1.createId)("audit"),
            tenantId,
            actorScope: "tenant",
            actorName: input.operatorName ?? "tenant_console",
            actorRole: input.operatorRole ?? "tenant_console",
            action: "floor.create",
            targetType: "floor",
            targetId: id,
            result: "success",
            detail: `${input.buildingId} / ${name}`,
            createdAt,
        });
        const row = await client.query("SELECT * FROM tenant_floors WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, id]);
        return (0, _shared_1.mapFloor)(row.rows[0]);
    });
}
async function updateTenantFloor(tenantId, floorId, input) {
    (0, errors_1.assertTenantId)(tenantId);
    const updatedAt = (0, _shared_1.formatLocalTimestamp)();
    return (0, transaction_1.withTransaction)(async (client) => {
        const existing = await client.query("SELECT * FROM tenant_floors WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, floorId]);
        if (existing.rowCount === 0)
            throw new errors_1.EntityNotFoundError("floor", floorId);
        await client.query(`
        UPDATE tenant_floors
        SET name = $1,
            code = $2,
            level_index = $3,
            sort_order = $4,
            status = $5,
            description = $6
        WHERE tenant_id = $7 AND id = $8
      `, [
            input.name?.trim() || existing.rows[0].name,
            input.code?.trim() || existing.rows[0].code,
            Number(input.levelIndex ?? existing.rows[0].level_index ?? 0),
            Number(input.sortOrder ?? existing.rows[0].sort_order ?? existing.rows[0].level_index ?? 0),
            normalizeStatus(input.status ?? existing.rows[0].status),
            input.description?.trim() ?? existing.rows[0].description ?? "",
            tenantId,
            floorId,
        ]);
        await (0, audit_repository_1.insertAuditLog)(client, {
            id: (0, _shared_1.createId)("audit"),
            tenantId,
            actorScope: "tenant",
            actorName: input.operatorName ?? "tenant_console",
            actorRole: input.operatorRole ?? "tenant_console",
            action: "floor.update",
            targetType: "floor",
            targetId: floorId,
            result: "success",
            detail: input.name?.trim() || existing.rows[0].name,
            createdAt: updatedAt,
        });
        const row = await client.query("SELECT * FROM tenant_floors WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, floorId]);
        return (0, _shared_1.mapFloor)(row.rows[0]);
    });
}
async function deleteTenantFloor(tenantId, floorId, input) {
    (0, errors_1.assertTenantId)(tenantId);
    const deletedAt = (0, _shared_1.formatLocalTimestamp)();
    return (0, transaction_1.withTransaction)(async (client) => {
        const floor = await client.query("SELECT * FROM tenant_floors WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, floorId]);
        if (floor.rowCount === 0)
            throw new errors_1.EntityNotFoundError("floor", floorId);
        const drawings = await client.query("SELECT id FROM tenant_drawings WHERE tenant_id = $1 AND floor_id = $2 LIMIT 1", [tenantId, floorId]);
        const points = await client.query("SELECT id FROM tenant_device_points WHERE tenant_id = $1 AND floor_id = $2 LIMIT 1", [tenantId, floorId]);
        if ((drawings.rowCount ?? 0) > 0 || (points.rowCount ?? 0) > 0) {
            throw new errors_1.RepositoryError("FLOOR_HAS_LINKED_DATA", "FLOOR_HAS_LINKED_DATA");
        }
        await client.query("DELETE FROM tenant_floors WHERE tenant_id = $1 AND id = $2", [tenantId, floorId]);
        await client.query("UPDATE tenant_buildings SET level_count = (SELECT COUNT(*) FROM tenant_floors WHERE tenant_id = $1 AND building_id = $2) WHERE tenant_id = $1 AND id = $2", [tenantId, floor.rows[0].building_id]);
        await (0, audit_repository_1.insertAuditLog)(client, {
            id: (0, _shared_1.createId)("audit"),
            tenantId,
            actorScope: "tenant",
            actorName: input?.operatorName ?? "tenant_console",
            actorRole: input?.operatorRole ?? "tenant_console",
            action: "floor.delete",
            targetType: "floor",
            targetId: floorId,
            result: "success",
            detail: String(floor.rows[0].name ?? ""),
            createdAt: deletedAt,
        });
        return { success: true };
    });
}
