"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTenantOverviewData = getTenantOverviewData;
const client_1 = require("../client");
const errors_1 = require("../errors");
const _shared_1 = require("./_shared");
async function getTenantOverviewData(tenantId) {
    (0, errors_1.assertTenantId)(tenantId);
    const [tenantRow, subscriptionRow, settingsRow, quotaRow, devices, alarms, users] = await Promise.all([
        (0, client_1.queryDb)("SELECT * FROM tenants WHERE id = $1 LIMIT 1", [tenantId]),
        (0, client_1.queryDb)("SELECT * FROM subscriptions WHERE tenant_id = $1 LIMIT 1", [tenantId]),
        (0, client_1.queryDb)("SELECT * FROM notification_settings WHERE tenant_id = $1 LIMIT 1", [tenantId]),
        (0, client_1.queryDb)("SELECT * FROM quota_usage WHERE tenant_id = $1 LIMIT 1", [tenantId]),
        (0, client_1.queryDb)("SELECT * FROM tenant_devices WHERE tenant_id = $1 ORDER BY name ASC", [tenantId]),
        (0, client_1.queryDb)("SELECT * FROM tenant_alarms WHERE tenant_id = $1 ORDER BY time DESC", [tenantId]),
        (0, client_1.queryDb)("SELECT * FROM tenant_users WHERE tenant_id = $1 ORDER BY username ASC", [tenantId]),
    ]);
    const subscription = subscriptionRow.rows[0] ? (0, _shared_1.mapSubscription)(subscriptionRow.rows[0]) : null;
    const planRow = subscription
        ? await (0, client_1.queryDb)("SELECT * FROM plans WHERE id = $1 LIMIT 1", [subscription.planId])
        : { rows: [] };
    return {
        tenant: tenantRow.rows[0] ? (0, _shared_1.mapTenant)(tenantRow.rows[0]) : null,
        subscription,
        plan: planRow.rows[0] ? (0, _shared_1.mapPlan)(planRow.rows[0]) : null,
        devices: devices.rows.map(_shared_1.mapTenantDevice),
        alarms: alarms.rows.map(_shared_1.mapAlarm),
        users: users.rows.map(_shared_1.mapTenantUser),
        settings: settingsRow.rows[0] ? (0, _shared_1.mapNotificationSetting)(settingsRow.rows[0]) : null,
        quota: quotaRow.rows[0] ? (0, _shared_1.mapQuota)(quotaRow.rows[0]) : null,
    };
}
