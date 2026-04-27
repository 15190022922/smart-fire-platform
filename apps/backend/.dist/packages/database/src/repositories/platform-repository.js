"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlatformOverviewData = getPlatformOverviewData;
exports.listPlatformTenants = listPlatformTenants;
const client_1 = require("../client");
const _shared_1 = require("./_shared");
async function getPlatformOverviewData() {
    const [tenants, plans, subscriptions, platformUsers] = await Promise.all([
        (0, client_1.queryDb)("SELECT * FROM tenants ORDER BY created_at ASC"),
        (0, client_1.queryDb)("SELECT * FROM plans ORDER BY name ASC"),
        (0, client_1.queryDb)("SELECT * FROM subscriptions ORDER BY start_date DESC"),
        (0, client_1.queryDb)("SELECT * FROM platform_users ORDER BY username ASC"),
    ]);
    return {
        tenants: tenants.rows.map(_shared_1.mapTenant),
        plans: plans.rows.map(_shared_1.mapPlan),
        subscriptions: subscriptions.rows.map(_shared_1.mapSubscription),
        platformUsers: platformUsers.rows.map(_shared_1.mapPlatformUser),
    };
}
async function listPlatformTenants() {
    const overview = await getPlatformOverviewData();
    return overview.tenants;
}
