import { queryDb } from "../client";
import { assertTenantId } from "../errors";
import {
  mapAlarm,
  mapNotificationSetting,
  mapPlan,
  mapQuota,
  mapSubscription,
  mapTenant,
  mapTenantDevice,
  mapTenantUser,
} from "./_shared";

export type TenantOverviewData = {
  tenant: ReturnType<typeof mapTenant> | null;
  subscription: ReturnType<typeof mapSubscription> | null;
  plan: ReturnType<typeof mapPlan> | null;
  devices: ReturnType<typeof mapTenantDevice>[];
  alarms: ReturnType<typeof mapAlarm>[];
  users: ReturnType<typeof mapTenantUser>[];
  settings: ReturnType<typeof mapNotificationSetting> | null;
  quota: ReturnType<typeof mapQuota> | null;
};

export async function getTenantOverviewData(tenantId: string): Promise<TenantOverviewData> {
  assertTenantId(tenantId);

  const [tenantRow, subscriptionRow, settingsRow, quotaRow, devices, alarms, users] = await Promise.all([
    queryDb("SELECT * FROM tenants WHERE id = $1 LIMIT 1", [tenantId]),
    queryDb("SELECT * FROM subscriptions WHERE tenant_id = $1 LIMIT 1", [tenantId]),
    queryDb("SELECT * FROM notification_settings WHERE tenant_id = $1 LIMIT 1", [tenantId]),
    queryDb("SELECT * FROM quota_usage WHERE tenant_id = $1 LIMIT 1", [tenantId]),
    queryDb("SELECT * FROM tenant_devices WHERE tenant_id = $1 ORDER BY name ASC", [tenantId]),
    queryDb("SELECT * FROM tenant_alarms WHERE tenant_id = $1 ORDER BY time DESC", [tenantId]),
    queryDb("SELECT * FROM tenant_users WHERE tenant_id = $1 ORDER BY username ASC", [tenantId]),
  ]);

  const subscription = subscriptionRow.rows[0] ? mapSubscription(subscriptionRow.rows[0]) : null;
  const planRow = subscription
    ? await queryDb("SELECT * FROM plans WHERE id = $1 LIMIT 1", [subscription.planId])
    : { rows: [] as Record<string, unknown>[] };

  return {
    tenant: tenantRow.rows[0] ? mapTenant(tenantRow.rows[0]) : null,
    subscription,
    plan: planRow.rows[0] ? mapPlan(planRow.rows[0]) : null,
    devices: devices.rows.map(mapTenantDevice),
    alarms: alarms.rows.map(mapAlarm),
    users: users.rows.map(mapTenantUser),
    settings: settingsRow.rows[0] ? mapNotificationSetting(settingsRow.rows[0]) : null,
    quota: quotaRow.rows[0] ? mapQuota(quotaRow.rows[0]) : null,
  };
}
