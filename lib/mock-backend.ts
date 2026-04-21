import {
  featureDefinitions,
  planRecords,
  platformUsers,
  subscriptionRecords,
  tenantAlarms,
  tenantDevices,
  tenantNotificationSettings,
  tenantRecords,
  tenantUsers,
} from "@/data/saas-data";
import { LoginAccount } from "@/types/auth";

export const loginAccounts: LoginAccount[] = [
  {
    id: "account-platform-1",
    username: "platform_admin",
    password: "Admin123456",
    displayName: "平台超级管理员",
    scope: "platform",
    roleKey: "platform_super_admin",
  },
  {
    id: "account-tenant-hx-1",
    username: "hx_admin",
    password: "Hx123456",
    displayName: "华星制造管理员",
    scope: "tenant",
    roleKey: "tenant_level_1",
    tenantId: "tenant-huaxing",
  },
  {
    id: "account-tenant-ah-1",
    username: "ah_admin",
    password: "Ah123456",
    displayName: "安和商业中心管理员",
    scope: "tenant",
    roleKey: "tenant_level_1",
    tenantId: "tenant-anhe",
  },
];

export function findLoginAccount(username: string, password: string) {
  return loginAccounts.find((account) => account.username === username && account.password === password) ?? null;
}

export function getTenantById(tenantId?: string) {
  if (!tenantId) {
    return null;
  }
  return tenantRecords.find((tenant) => tenant.id === tenantId) ?? null;
}

export function getPlatformOverview() {
  return {
    tenants: tenantRecords,
    plans: planRecords,
    subscriptions: subscriptionRecords,
    platformUsers,
    features: featureDefinitions,
  };
}

export function getTenantOverview(tenantId: string) {
  return {
    tenant: tenantRecords.find((item) => item.id === tenantId) ?? null,
    subscription: subscriptionRecords.find((item) => item.tenantId === tenantId) ?? null,
    plan: (() => {
      const subscription = subscriptionRecords.find((item) => item.tenantId === tenantId);
      return planRecords.find((item) => item.id === subscription?.planId) ?? null;
    })(),
    devices: tenantDevices.filter((item) => item.tenantId === tenantId),
    alarms: tenantAlarms.filter((item) => item.tenantId === tenantId),
    users: tenantUsers.filter((item) => item.tenantId === tenantId),
    settings: tenantNotificationSettings.find((item) => item.tenantId === tenantId) ?? null,
  };
}
