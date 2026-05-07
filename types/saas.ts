export type SaaSViewMode = "platform" | "tenant";

export type PlatformRoleKey =
  | "platform_super_admin"
  | "platform_ops_admin"
  | "platform_finance_admin";

export type TenantRoleKey = "tenant_level_1" | "tenant_level_2" | "tenant_level_3";

export type RoleScope = "platform" | "tenant";

export type FeatureKey =
  | "dashboard"
  | "alarm_center"
  | "device_management"
  | "user_management"
  | "settings"
  | "advanced_reports"
  | "maintenance"
  | "api_access";

export type PermissionKey =
  | "platform.dashboard.view"
  | "platform.tenants.manage"
  | "platform.plans.manage"
  | "platform.subscriptions.manage"
  | "platform.features.manage"
  | "platform.users.manage"
  | "platform.notices.manage"
  | "platform.finance.view"
  | "tenant.dashboard.view"
  | "tenant.alarms.view"
  | "tenant.devices.view"
  | "tenant.devices.manage"
  | "tenant.users.view"
  | "tenant.users.manage"
  | "tenant.settings.view"
  | "tenant.settings.manage"
  | "tenant.notifications.manage";

export type TenantStatus = "启用" | "停用";
export type PlanStatus = "启用" | "停用";
export type SubscriptionStatus =
  | "试用中"
  | "已生效"
  | "已过期"
  | "已停用";
export type UserStatus = "启用" | "停用";
export type DeviceStatus =
  | "正常"
  | "报警"
  | "故障"
  | "离线"
  | "维修中";
export type DeviceInstallationStatus = "已安装" | "未安装" | "停用" | "未知" | string;
export type DeviceAttributeType = "auto" | "text" | "number" | "date" | "boolean";
export type DeviceDuplicatePolicy = "skip" | "update" | "error";
export type DeviceLifecycleStatus = "active" | "disabled";
export type DeviceLifecycleFilter = DeviceLifecycleStatus | "all";
export type DeviceLifecycleAction = "disable" | "restore";

export type AlarmProcessStatus =
  | "未处理"
  | "处理中"
  | "已处理";
export type NotificationType = "报警信息" | "故障信息";

export type FeatureDefinition = {
  key: FeatureKey;
  name: string;
  description: string;
  category: "基础能力" | "增值能力";
};

export type RoleDefinition = {
  key: PlatformRoleKey | TenantRoleKey;
  scope: RoleScope;
  name: string;
  description: string;
  permissions: PermissionKey[];
};

export type TenantRecord = {
  id: string;
  name: string;
  code: string;
  industry: string;
  contactName: string;
  contactPhone: string;
  status: TenantStatus;
  createdAt: string;
  note: string;
};

export type PlanRecord = {
  id: string;
  name: string;
  code: string;
  status: PlanStatus;
  priceMonthly: number;
  maxDevices: number;
  maxUsers: number;
  smsQuota: number;
  featureKeys: FeatureKey[];
  description: string;
};

export type SubscriptionRecord = {
  id: string;
  tenantId: string;
  planId: string;
  status: SubscriptionStatus;
  startDate: string;
  endDate: string;
  trial: boolean;
  autoRenew: boolean;
};

export type PlatformUserRecord = {
  id: string;
  username: string;
  phone: string;
  roleKey: PlatformRoleKey;
  status: UserStatus;
  note: string;
};

export type TenantUserRecord = {
  id: string;
  tenantId: string;
  username: string;
  phone: string;
  roleKey: TenantRoleKey;
  status: UserStatus;
  smsEnabled: boolean;
  messageTypes: NotificationType[];
  note: string;
};

export type TenantDeviceRecord = {
  id: string;
  tenantId: string;
  deviceCode?: string;
  name: string;
  type: string;
  area: string;
  location: string;
  status: DeviceStatus;
  installationStatus?: DeviceInstallationStatus;
  lastReportAt: string;
  installationLocation?: string;
  notes?: string;
  customAttributes?: Record<string, string | number | boolean | null>;
  lifecycleStatus?: DeviceLifecycleStatus;
  disabledAt?: string;
  disabledReason?: string;
  siteId?: string;
  buildingId?: string;
  floorId?: string;
  gatewayId?: string;
  modelCode?: string;
  protocolType?: string;
  serialNumber?: string;
};

export type TenantDeviceAttributeDefinition = {
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

export type DeviceImportRow = {
  rowNumber: number;
  values: Record<string, string>;
};

export type DeviceImportError = {
  rowNumber: number;
  message: string;
};

export type DeviceImportPreview = {
  fileName: string;
  headers: string[];
  rows: DeviceImportRow[];
  previewRows: DeviceImportRow[];
  totalRows: number;
  importableRows: number;
  duplicateRows: number;
  errors: DeviceImportError[];
  missingHeaders: string[];
  unknownHeaders: string[];
};

export type DeviceLifecyclePreviewItem = {
  deviceId: string;
  deviceCode: string;
  name: string;
  lifecycleStatus: DeviceLifecycleStatus;
  pointCount: number;
  openAlarmCount: number;
  rawEventCount: number;
  maintenanceRecordCount: number;
  canUpdate: boolean;
  message: string;
};

export type DeviceLifecyclePreview = {
  action: DeviceLifecycleAction;
  total: number;
  updateable: number;
  skipped: number;
  missing: number;
  pointCount: number;
  openAlarmCount: number;
  rawEventCount: number;
  maintenanceRecordCount: number;
  devices: DeviceLifecyclePreviewItem[];
};

export type DeviceLifecycleCommitResult = DeviceLifecyclePreview & {
  updated: number;
  failed: number;
  results: { deviceId: string; status: "updated" | "skipped" | "failed"; message: string }[];
};

export type TenantAlarmRecord = {
  id: string;
  tenantId: string;
  deviceId: string;
  deviceName: string;
  location: string;
  alarmType: string;
  time: string;
  processStatus: AlarmProcessStatus;
};

export type TenantNotificationSetting = {
  tenantId: string;
  alarmThreshold: string;
  notificationEnabled: boolean;
  mapPlaceholder: string;
  remark: string;
};

export type NavigationLink = {
  href: string;
  label: string;
  featureKey?: FeatureKey;
  permissionKey?: PermissionKey;
};

export type TenantQuotaUsage = {
  tenantId: string;
  deviceCount: number;
  userCount: number;
  smsUsed: number;
};
