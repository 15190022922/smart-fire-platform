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
    void input;
    throw new Error("Full admin-state replacement is disabled. Use scoped admin repository methods.");
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
        await client.query("DELETE FROM platform_notice_deliveries WHERE tenant_id = $1", [tenantId]);
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
