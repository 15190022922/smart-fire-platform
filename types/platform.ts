export type NavigationItem = {
  href: string;
  label: string;
  shortLabel: string;
};

export type DashboardMetric = {
  title: string;
  value: string;
  unit?: string;
  trendLabel: string;
  description: string;
  tone: "danger" | "warning" | "success" | "info";
};

export type AlarmTrendPoint = {
  label: string;
  total: number;
  pending: number;
  handled: number;
};

export type AlarmTypeStat = {
  label: string;
  count: number;
  ratio: string;
  colorClass: string;
};

export type AlarmPointStatus =
  | "正常"
  | "报警"
  | "故障"
  | "离线";

export type AlarmPoint = {
  id: string;
  deviceId: string;
  deviceName: string;
  positionLabel: string;
  deviceType: string;
  status: AlarmPointStatus;
  x: number;
  y: number;
  lastReportAt: string;
};

export type FloorZone = {
  id: string;
  level: string;
  name: string;
  riskLevel: string;
  points: AlarmPoint[];
};

export type ProcessStatus = string;

export type AlarmRecord = {
  id: string;
  time: string;
  deviceName: string;
  location: string;
  alarmType: string;
  processStatus: ProcessStatus;
  isCarryover?: boolean;
  isActive?: boolean;
};

export type DeviceStatus =
  | "正常"
  | "报警"
  | "故障"
  | "离线"
  | "维修中";

export type DeviceStatusFilter = DeviceStatus | "全部";
export type DeviceInstallationStatus = "已安装" | "未安装" | "停用" | "未知" | string;
export type DeviceAttributeType = "auto" | "text" | "number" | "date" | "boolean";
export type DeviceLifecycleStatus = "active" | "disabled";
export type DeviceLifecycleFilter = DeviceLifecycleStatus | "all";
export type DeviceLifecycleAction = "disable" | "restore";

export type DeviceRecord = {
  id: string;
  deviceCode?: string;
  name: string;
  type: string;
  area: string;
  installationLocation: string;
  location: string;
  status: DeviceStatus;
  installationStatus?: DeviceInstallationStatus;
  lastReportAt: string;
  notes: string;
  customAttributes?: Record<string, string | number | boolean | null>;
  lifecycleStatus?: DeviceLifecycleStatus;
  disabledAt?: string;
  disabledReason?: string;
};

export type DeviceAttributeDefinition = {
  tenantId: string;
  fieldKey: string;
  label: string;
  fieldType: DeviceAttributeType;
  required: boolean;
  enabled: boolean;
  showInList: boolean;
  sortOrder: number;
  isCore: boolean;
};

export type DeviceOverviewItem = {
  label: string;
  count: number;
  ratio: string;
  barClass: string;
};

export type DeviceOverview = {
  total: number;
  online: number;
  offline: number;
  fault: number;
  maintenance: number;
  onlineRate: string;
  breakdown: DeviceOverviewItem[];
};

export type DeviceCategoryStat = {
  label: string;
  count: number;
  ratio: string;
  colorClass: string;
};

export type StatusSummaryItem = {
  label: string;
  count: number;
  tone: "success" | "danger" | "warning" | "muted" | "info";
};

export type UserStatus = "启用" | "停用";

export type UserLevel =
  | "一级用户"
  | "二级用户"
  | "三级用户";

export type NotificationMessageType =
  | "报警信息"
  | "故障信息";

export type UserRecord = {
  id: string;
  username: string;
  phone: string;
  level: UserLevel;
  status: UserStatus;
  smsEnabled: boolean;
  messageTypes: NotificationMessageType[];
  note: string;
};

export type PermissionPreset = {
  level: UserLevel;
  title: string;
  description: string;
  capabilities: string[];
};

export type NotificationRule = {
  level: UserLevel;
  smsEnabledByDefault: boolean;
  messageTypes: NotificationMessageType[];
};

export type SystemSettings = {
  projectName: string;
  alarmThreshold: string;
  notificationEnabled: boolean;
  mapPlaceholder: string;
  remark: string;
  notificationRules: NotificationRule[];
};
