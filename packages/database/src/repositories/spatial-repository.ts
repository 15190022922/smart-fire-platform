import type { TenantSpatialModel } from "../../../../types/hardware";
import { queryDb } from "../client";
import { assertTenantId } from "../errors";
import {
  formatLocalTimestamp,
  mapBuilding,
  mapDevicePoint,
  mapDeviceStatusSnapshot,
  mapDrawing,
  mapFloor,
  mapGateway,
  mapRawDeviceEvent,
  mapSite,
} from "./_shared";

export async function getTenantSpatialModelData(tenantId: string): Promise<TenantSpatialModel> {
  assertTenantId(tenantId);
  const [sites, buildings, floors, drawings, gateways, devicePoints, statusSnapshots, recentEvents, devices] = await Promise.all([
    queryDb("SELECT * FROM tenant_sites WHERE tenant_id = $1 ORDER BY name ASC", [tenantId]),
    queryDb("SELECT * FROM tenant_buildings WHERE tenant_id = $1 ORDER BY name ASC", [tenantId]),
    queryDb("SELECT * FROM tenant_floors WHERE tenant_id = $1 ORDER BY level_index ASC", [tenantId]),
    queryDb("SELECT * FROM tenant_drawings WHERE tenant_id = $1 ORDER BY updated_at DESC", [tenantId]),
    queryDb("SELECT * FROM tenant_gateways WHERE tenant_id = $1 ORDER BY name ASC", [tenantId]),
    queryDb("SELECT * FROM tenant_device_points WHERE tenant_id = $1 ORDER BY updated_at DESC", [tenantId]),
    queryDb("SELECT * FROM device_status_snapshots WHERE tenant_id = $1 ORDER BY updated_at DESC", [tenantId]),
    queryDb("SELECT * FROM raw_device_events WHERE tenant_id = $1 ORDER BY reported_at DESC LIMIT 12", [tenantId]),
    queryDb("SELECT id FROM tenant_devices WHERE tenant_id = $1", [tenantId]),
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
    sites: sites.rows.map(mapSite),
    buildings: buildings.rows.map(mapBuilding),
    floors: floors.rows.map(mapFloor),
    drawings: drawings.rows.map(mapDrawing),
    gateways: gateways.rows.map(mapGateway),
    devicePoints: devicePoints.rows.map(mapDevicePoint),
    statusSnapshots: statusSnapshots.rows.map(mapDeviceStatusSnapshot),
    recentEvents: recentEvents.rows.map(mapRawDeviceEvent),
  };
}

export function emptyTenantSpatialModel(): TenantSpatialModel {
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

export function createSpatialGeneratedAt() {
  return formatLocalTimestamp();
}
