import { queryDb } from "../client";
import { mapPlan, mapPlatformUser, mapSubscription, mapTenant } from "./_shared";

export async function getPlatformOverviewData() {
  const [tenants, plans, subscriptions, platformUsers] = await Promise.all([
    queryDb("SELECT * FROM tenants ORDER BY created_at ASC"),
    queryDb("SELECT * FROM plans ORDER BY name ASC"),
    queryDb("SELECT * FROM subscriptions ORDER BY start_date DESC"),
    queryDb("SELECT * FROM platform_users ORDER BY username ASC"),
  ]);

  return {
    tenants: tenants.rows.map(mapTenant),
    plans: plans.rows.map(mapPlan),
    subscriptions: subscriptions.rows.map(mapSubscription),
    platformUsers: platformUsers.rows.map(mapPlatformUser),
  };
}

export async function listPlatformTenants() {
  const overview = await getPlatformOverviewData();
  return overview.tenants;
}
