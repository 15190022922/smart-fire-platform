"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTenantUsers = listTenantUsers;
exports.upsertTenantUser = upsertTenantUser;
exports.deleteTenantUser = deleteTenantUser;
const client_1 = require("../client");
const errors_1 = require("../errors");
const _shared_1 = require("./_shared");
const _shared_2 = require("./_shared");
async function listTenantUsers(tenantId) {
    (0, errors_1.assertTenantId)(tenantId);
    const result = await (0, client_1.queryDb)("SELECT * FROM tenant_users WHERE tenant_id = $1 ORDER BY username ASC", [tenantId]);
    return result.rows.map(_shared_2.mapTenantUser);
}
async function upsertTenantUser(executor, tenantId, input) {
    (0, errors_1.assertTenantId)(tenantId);
    const id = input.id ? String(input.id) : (0, _shared_1.createId)("tenant-user");
    const messageTypes = Array.isArray(input.messageTypes) ? input.messageTypes : [];
    await executor.query(`
      INSERT INTO tenant_users (id, tenant_id, username, phone, role_key, status, sms_enabled, message_types, note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
      ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        phone = EXCLUDED.phone,
        role_key = EXCLUDED.role_key,
        status = EXCLUDED.status,
        sms_enabled = EXCLUDED.sms_enabled,
        message_types = EXCLUDED.message_types,
        note = EXCLUDED.note
    `, [id, tenantId, input.username, input.phone, input.roleKey, input.status, Boolean(input.smsEnabled), JSON.stringify(messageTypes), input.note ?? ""]);
    const row = (await executor.query("SELECT * FROM tenant_users WHERE id = $1 AND tenant_id = $2", [id, tenantId])).rows[0];
    return (0, _shared_2.mapTenantUser)(row);
}
async function deleteTenantUser(executor, tenantId, id) {
    (0, errors_1.assertTenantId)(tenantId);
    await executor.query("DELETE FROM tenant_users WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
}
