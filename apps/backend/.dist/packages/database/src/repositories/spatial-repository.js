"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTenantSpatialModelData = getTenantSpatialModelData;
exports.emptyTenantSpatialModel = emptyTenantSpatialModel;
exports.createSpatialGeneratedAt = createSpatialGeneratedAt;
const client_1 = require("../client");
const errors_1 = require("../errors");
const _shared_1 = require("./_shared");
async function getTenantSpatialModelData(tenantId) {
    (0, errors_1.assertTenantId)(tenantId);
    const [sites, buildings, floors, drawings, gateways, devicePoints, statusSnapshots, recentEvents, devices] = await Promise.all([
        (0, client_1.queryDb)("SELECT * FROM tenant_sites WHERE tenant_id = $1 ORDER BY name ASC", [tenantId]),
        (0, client_1.queryDb)("SELECT * FROM tenant_buildings WHERE tenant_id = $1 ORDER BY sort_order ASC, name ASC", [tenantId]),
        (0, client_1.queryDb)("SELECT * FROM tenant_floors WHERE tenant_id = $1 ORDER BY sort_order ASC, level_index ASC", [tenantId]),
        (0, client_1.queryDb)("SELECT * FROM tenant_drawings WHERE tenant_id = $1 ORDER BY updated_at DESC", [tenantId]),
        (0, client_1.queryDb)("SELECT * FROM tenant_gateways WHERE tenant_id = $1 ORDER BY name ASC", [tenantId]),
        (0, client_1.queryDb)(`SELECT p.*
       FROM tenant_device_points p
       JOIN tenant_devices d ON d.tenant_id = p.tenant_id AND d.id = p.device_id
       WHERE p.tenant_id = $1 AND COALESCE(d.lifecycle_status, 'active') = 'active'
       ORDER BY p.updated_at DESC`, [tenantId]),
        (0, client_1.queryDb)(`SELECT s.*
       FROM device_status_snapshots s
       JOIN tenant_devices d ON d.tenant_id = s.tenant_id AND d.id = s.device_id
       WHERE s.tenant_id = $1 AND COALESCE(d.lifecycle_status, 'active') = 'active'
       ORDER BY s.updated_at DESC`, [tenantId]),
        (0, client_1.queryDb)(`SELECT e.*
       FROM raw_device_events e
       JOIN tenant_devices d ON d.tenant_id = e.tenant_id AND d.id = e.device_id
       WHERE e.tenant_id = $1 AND COALESCE(d.lifecycle_status, 'active') = 'active'
       ORDER BY e.reported_at DESC LIMIT 12`, [tenantId]),
        (0, client_1.queryDb)("SELECT id FROM tenant_devices WHERE tenant_id = $1 AND COALESCE(lifecycle_status, 'active') = 'active'", [tenantId]),
    ]);
    const totalDeviceCount = devices.rows.length;
    const mappedDeviceCount = new Set(devicePoints.rows.map((item) => item.device_id)).size;
    return {
        summary: {
            siteCount: sites.rows.length,
            buildingCount: buildings.rows.length,
            floorCount: floors.rows.length,
            drawingCount: drawings.rows.length,
            gatewayCount: gateways.rows.length,
            onlineGatewayCount: gateways.rows.filter((item) => item.status === "online").length,
            mappedDeviceCount,
            unmappedDeviceCount: Math.max(totalDeviceCount - mappedDeviceCount, 0),
            recentEventCount: recentEvents.rows.length,
        },
        sites: sites.rows.map(_shared_1.mapSite),
        buildings: buildings.rows.map(_shared_1.mapBuilding),
        floors: floors.rows.map(_shared_1.mapFloor),
        drawings: drawings.rows.map(_shared_1.mapDrawing),
        gateways: gateways.rows.map(_shared_1.mapGateway),
        devicePoints: devicePoints.rows.map(_shared_1.mapDevicePoint),
        statusSnapshots: statusSnapshots.rows.map(_shared_1.mapDeviceStatusSnapshot),
        recentEvents: recentEvents.rows.map(_shared_1.mapRawDeviceEvent),
    };
}
function emptyTenantSpatialModel() {
    return {
        summary: {
            siteCount: 0,
            buildingCount: 0,
            floorCount: 0,
            drawingCount: 0,
            gatewayCount: 0,
            onlineGatewayCount: 0,
            mappedDeviceCount: 0,
            unmappedDeviceCount: 0,
            recentEventCount: 0,
        },
        sites: [],
        buildings: [],
        floors: [],
        drawings: [],
        gateways: [],
        devicePoints: [],
        statusSnapshots: [],
        recentEvents: [],
    };
}
function createSpatialGeneratedAt() {
    return (0, _shared_1.formatLocalTimestamp)();
}
