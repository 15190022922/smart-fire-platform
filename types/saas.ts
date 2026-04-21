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
export type SubscriptionStatus = "试用中" | "已生效" | "已过期" | "已停用";
export type UserStatus = "启用" | "停用";
export type DeviceStatus = "正常" | "报警" | "故障" | "离线" | "维修中";
export type AlarmProcessStatus = "未处理" | "处理中" | "已处理";
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
  name: string;
  type: string;
  area: string;
  location: string;
  status: DeviceStatus;
  lastReportAt: string;
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
