"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTenantById = getTenantById;
exports.getAdminStateData = getAdminStateData;
exports.replaceAdminStateData = replaceAdminStateData;
exports.createTenantWithAdminRecord = createTenantWithAdminRecord;
exports.updateTenantRecord = updateTenantRecord;
exports.deleteTenantCascadeRecord = deleteTenantCascadeRecord;
const client_1 = require("../client");
const errors_1 = require("../errors");
const transaction_1 = require("../transaction");
const _shared_1 = require("./_shared");
function formatLocalDate(date = new Date(), timeZone = "Asia/Shanghai") {
    const formatter = new Intl.DateTimeFormat("sv-SE", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
}
function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
async function getTenantById(tenantId) {
    if (!tenantId)
        return null;
    const row = await (0, client_1.queryDb)("SELECT * FROM tenants WHERE id = $1 LIMIT 1", [tenantId]);
    return row.rows[0] ? (0, _shared_1.mapTenant)(row.rows[0]) : null;
}
async function getAdminStateData() {
    const [tenants, plans, subscriptions, platformUsers, tenantUsers, tenantDevices, tenantAlarms, notificationSettings, quotaUsage] = await Promise.all([
        (0, client_1.queryDb)("SELECT * FROM tenants ORDER BY created_at ASC"),
        (0, client_1.queryDb)("SELECT * FROM plans ORDER BY name ASC"),
        (0, client_1.queryDb)("SELECT * FROM subscriptions ORDER BY start_date DESC"),
        (0, client_1.queryDb)("SELECT * FROM platform_users ORDER BY username ASC"),
        (0, client_1.queryDb)("SELECT * FROM tenant_users ORDER BY tenant_id ASC, username ASC"),
        (0, client_1.queryDb)("SELECT * FROM tenant_devices ORDER BY tenant_id ASC, name ASC"),
        (0, client_1.queryDb)("SELECT * FROM tenant_alarms ORDER BY time DESC"),
        (0, client_1.queryDb)("SELECT * FROM notification_settings ORDER BY tenant_id ASC"),
        (0, client_1.queryDb)("SELECT * FROM quota_usage ORDER BY tenant_id ASC"),
    ]);
    return {
        tenants: tenants.rows.map(_shared_1.mapTenant),
        plans: plans.rows.map(_shared_1.mapPlan),
        subscriptions: subscriptions.rows.map(_shared_1.mapSubscription),
        platformUsers: platformUsers.rows.map(_shared_1.mapPlatformUser),
        tenantUsers: tenantUsers.rows.map(_shared_1.mapTenantUser),
        tenantDevices: tenantDevices.rows.map(_shared_1.mapTenantDevice),
        tenantAlarms: tenantAlarms.rows.map(_shared_1.mapAlarm),
        notificationSettings: notificationSettings.rows.map(_shared_1.mapNotificationSetting),
        quotaUsage: quotaUsage.rows.map(_shared_1.mapQuota),
    };
}
async function replaceAdminStateData(input) {
    return (0, transaction_1.withTransaction)(async (client) => {
        await client.query(`
      DELETE FROM subscriptions;
      DELETE FROM platform_users;
      DELETE FROM tenant_users;
      DELETE FROM tenant_alarms;
      DELETE FROM tenant_devices;
      DELETE FROM notification_settings;
      DELETE FROM quota_usage;
      DELETE FROM plans;
      DELETE FROM tenants;
    `);
        for (const item of input.tenants ?? []) {
            await client.query("INSERT INTO tenants (id, name, code, industry, contact_name, contact_phone, status, created_at, note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)", [item.id, item.name, item.code, item.industry, item.contactName, item.contactPhone, item.status, item.createdAt, item.note]);
        }
        for (const item of input.plans ?? []) {
            await client.query("INSERT INTO plans (id, name, code, status, price_monthly, max_devices, max_users, sms_quota, feature_keys, description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)", [item.id, item.name, item.code, item.status, item.priceMonthly, item.maxDevices, item.maxUsers, item.smsQuota, JSON.stringify(item.featureKeys ?? []), item.description]);
        }
        for (const item of input.subscriptions ?? []) {
            await client.query("INSERT INTO subscriptions (id, tenant_id, plan_id, status, start_date, end_date, trial, auto_renew) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [item.id, item.tenantId, item.planId, item.status, item.startDate, item.endDate, !!item.trial, !!item.autoRenew]);
        }
        for (const item of input.platformUsers ?? []) {
            await client.query("INSERT INTO platform_users (id, username, phone, role_key, status, note) VALUES ($1,$2,$3,$4,$5,$6)", [item.id, item.username, item.phone, item.roleKey, item.status, item.note]);
        }
        for (const item of input.tenantUsers ?? []) {
            await client.query("INSERT INTO tenant_users (id, tenant_id, username, phone, role_key, status, sms_enabled, message_types, note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)", [item.id, item.tenantId, item.username, item.phone, item.roleKey, item.status, !!item.smsEnabled, JSON.stringify(item.messageTypes ?? []), item.note]);
        }
        for (const item of input.tenantDevices ?? []) {
            await client.query("INSERT INTO tenant_devices (id, tenant_id, name, type, area, installation_location, status, last_report_at, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)", [item.id, item.tenantId, item.name, item.type, item.area, item.installationLocation ?? item.location, item.status, item.lastReportAt, item.notes ?? ""]);
        }
        for (const item of input.tenantAlarms ?? []) {
            await client.query("INSERT INTO tenant_alarms (id, tenant_id, device_id, device_name, location, alarm_type, time, process_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [item.id, item.tenantId, item.deviceId, item.deviceName, item.location, item.alarmType, item.time, item.processStatus]);
        }
        for (const item of input.notificationSettings ?? []) {
            await client.query("INSERT INTO notification_settings (id, tenant_id, alarm_threshold, notification_enabled, map_placeholder, remark) VALUES ($1,$2,$3,$4,$5,$6)", [("id" in item && item.id) ? item.id : createId("notification"), item.tenantId, item.alarmThreshold, !!item.notificationEnabled, item.mapPlaceholder, item.remark]);
        }
        for (const item of input.quotaUsage ?? []) {
            await client.query("INSERT INTO quota_usage (id, tenant_id, device_count, user_count, sms_used) VALUES ($1,$2,$3,$4,$5)", [("id" in item && item.id) ? item.id : createId("quota"), item.tenantId, item.deviceCount, item.userCount, item.smsUsed]);
        }
    });
}
async function createTenantWithAdminRecord(input) {
    const tenantId = createId("tenant");
    const tenantUserId = createId("tenant-user");
    const loginAccountId = createId("login-account");
    const createdAt = formatLocalDate();
    const displayName = input.admin.displayName || `${input.tenant.name}管理员`;
    await (0, transaction_1.withTransaction)(async (client) => {
        await client.query("INSERT INTO tenants (id, name, code, industry, contact_name, contact_phone, status, created_at, note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)", [tenantId, input.tenant.name, input.tenant.code, input.tenant.industry, input.tenant.contactName, input.tenant.contactPhone, input.tenant.status, createdAt, input.tenant.note]);
        await client.query("INSERT INTO tenant_users (id, tenant_id, username, phone, role_key, status, sms_enabled, message_types, note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)", [tenantUserId, tenantId, input.admin.username, input.admin.phone, input.admin.roleKey, "启用", true, JSON.stringify(["报警信息"]), input.admin.note]);
        await client.query("INSERT INTO login_accounts (id, username, password, password_hash, display_name, scope, role_key, tenant_id, must_change_password) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)", [loginAccountId, input.admin.username, "", input.admin.passwordHash, displayName, "tenant", input.admin.roleKey, tenantId, true]);
    });
    return {
        tenant: {
            id: tenantId,
            name: input.tenant.name,
            code: input.tenant.code,
            industry: input.tenant.industry,
            contactName: input.tenant.contactName,
            contactPhone: input.tenant.contactPhone,
            status: input.tenant.status,
            createdAt,
            note: input.tenant.note,
        },
        tenantUser: {
            id: tenantUserId,
            tenantId,
            username: input.admin.username,
            phone: input.admin.phone,
            roleKey: input.admin.roleKey,
            status: "启用",
            smsEnabled: true,
            messageTypes: ["报警信息"],
            note: input.admin.note,
        },
    };
}
async function updateTenantRecord(input) {
    await (0, client_1.queryDb)("UPDATE tenants SET name = $1, code = $2, industry = $3, contact_name = $4, contact_phone = $5, status = $6, note = $7 WHERE id = $8", [input.name, input.code, input.industry, input.contactName, input.contactPhone, input.status, input.note, input.id]);
    const row = await (0, client_1.queryDb)("SELECT * FROM tenants WHERE id = $1 LIMIT 1", [input.id]);
    return row.rows[0] ? (0, _shared_1.mapTenant)(row.rows[0]) : null;
}
async function deleteTenantCascadeRecord(tenantId) {
    const tenant = await getTenantById(tenantId);
    if (!tenant) {
        throw new errors_1.EntityNotFoundError("tenant", tenantId);
    }
    await (0, transaction_1.withTransaction)(async (client) => {
        await client.query("DELETE FROM login_accounts WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM alarm_logs WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM subscriptions WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM notification_records WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM notification_templates WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM audit_logs WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM duty_logs WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM duty_schedules WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM duty_shifts WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM inspection_records WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM inspection_tasks WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM issues WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM maintenance_records WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM raw_device_events WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM device_status_snapshots WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM tenant_users WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM tenant_alarms WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM tenant_devices WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM tenant_gateways WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM notification_settings WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM quota_usage WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM tenant_device_points WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM tenant_drawings WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM tenant_floors WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM tenant_buildings WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM tenant_sites WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM tenants WHERE id = $1", [tenantId]);
    });
}
