export type SiteStatus = "active" | "inactive";
export type DrawingStatus = "draft" | "published" | "archived";
export type GatewayStatus = "online" | "offline" | "fault";
export type PointStyleStatus = "normal" | "alarm" | "fault" | "offline";
export type DeviceRuntimeStatus = "normal" | "alarm" | "fault" | "offline" | "maintenance";
export type DeviceEventType = "alarm" | "fault" | "recover" | "heartbeat" | "status_change";
export type DeviceEventLevel = "info" | "warning" | "critical";

export type TenantSiteRecord = {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  address: string;
  status: SiteStatus;
  description: string;
};

export type TenantBuildingRecord = {
  id: string;
  tenantId: string;
  siteId: string;
  name: string;
  code: string;
  levelCount: number;
  usageType: string;
};

export type TenantFloorRecord = {
  id: string;
  tenantId: string;
  buildingId: string;
  name: string;
  code: string;
  levelIndex: number;
  description: string;
};

export type TenantDrawingRecord = {
  id: string;
  tenantId: string;
  floorId: string;
  name: string;
  fileUrl: string;
  width: number;
  height: number;
  version: string;
  status: DrawingStatus;
  updatedAt: string;
};

export type TenantGatewayRecord = {
  id: string;
  tenantId: string;
  siteId: string;
  name: string;
  protocol: string;
  serialNumber: string;
  status: GatewayStatus;
  lastSeenAt: string;
};

export type TenantDevicePointRecord = {
  id: string;
  tenantId: string;
  deviceId: string;
  floorId: string;
  drawingId: string;
  x: number;
  y: number;
  rotation: number;
  icon: string;
  statusStyle: PointStyleStatus;
  updatedAt: string;
};

export type RawDeviceEventRecord = {
  id: string;
  tenantId: string;
  deviceId: string;
  gatewayId?: string;
  eventType: DeviceEventType;
  eventCode: string;
  eventLevel: DeviceEventLevel;
  payload: Record<string, unknown>;
  reportedAt: string;
};

export type DeviceStatusSnapshotRecord = {
  deviceId: string;
  tenantId: string;
  gatewayId?: string;
  status: DeviceRuntimeStatus;
  lastEventType: DeviceEventType;
  lastEventCode: string;
  lastReportedAt: string;
  updatedAt: string;
};

export type TenantSpatialSummary = {
  siteCount: number;
  buildingCount: number;
  floorCount: number;
  drawingCount: number;
  gatewayCount: number;
  onlineGatewayCount: number;
  mappedDeviceCount: number;
  unmappedDeviceCount: number;
  recentEventCount: number;
};

export type TenantSpatialModel = {
  summary: TenantSpatialSummary;
  sites: TenantSiteRecord[];
  buildings: TenantBuildingRecord[];
  floors: TenantFloorRecord[];
  drawings: TenantDrawingRecord[];
  gateways: TenantGatewayRecord[];
  devicePoints: TenantDevicePointRecord[];
  statusSnapshots: DeviceStatusSnapshotRecord[];
  recentEvents: RawDeviceEventRecord[];
};
