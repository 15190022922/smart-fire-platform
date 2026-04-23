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
  | "离线"
  | "濮濓絽鐖?"
  | "閹躱儴顒?"
  | "閺佸懘娈?"
  | "缁傝崵鍤?";

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
  | "维修中"
  | "濮濓絽鐖?"
  | "閹躱儴顒?"
  | "閺佸懘娈?"
  | "缁傝崵鍤?"
  | "缂佺繝鎱ㄦ稉?";

export type DeviceStatusFilter = DeviceStatus | "全部";

export type DeviceRecord = {
  id: string;
  name: string;
  type: string;
  area: string;
  installationLocation: string;
  location: string;
  status: DeviceStatus;
  lastReportAt: string;
  notes: string;
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

export type UserStatus = "启用" | "停用" | "閸氼垳鏁?" | "閸嬫粎鏁?";

export type UserLevel =
  | "一级用户"
  | "二级用户"
  | "三级用户"
  | "娑撯偓缁狙呮暏閹?"
  | "娴滃瞼楠囬悽銊﹀煕"
  | "娑撳楠囬悽銊﹀煕";

export type NotificationMessageType =
  | "报警信息"
  | "故障信息"
  | "閹躱儴顒熸穱鈩冧紖"
  | "閺佸懘娈版穱鈩冧紖";

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
