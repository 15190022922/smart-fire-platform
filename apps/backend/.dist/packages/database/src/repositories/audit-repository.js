"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTenantAuditLogs = listTenantAuditLogs;
exports.insertAuditLog = insertAuditLog;
exports.createAuditLogEntry = createAuditLogEntry;
const client_1 = require("../client");
const errors_1 = require("../errors");
const transaction_1 = require("../transaction");
const _shared_1 = require("./_shared");
const _shared_2 = require("./_shared");
async function listTenantAuditLogs(tenantId) {
    (0, errors_1.assertTenantId)(tenantId);
    const result = await (0, client_1.queryDb)("SELECT * FROM audit_logs WHERE tenant_id = $1 OR tenant_id IS NULL ORDER BY created_at DESC LIMIT 500", [tenantId]);
    return result.rows.map(_shared_2.mapAuditLog);
}
async function insertAuditLog(executor, input) {
    if (input.tenantId) {
        (0, errors_1.assertTenantId)(input.tenantId);
    }
    await executor.query(`INSERT INTO audit_logs (id, tenant_id, actor_scope, actor_name, actor_role, action, target_type, target_id, result, detail, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [
        input.id,
        input.tenantId ?? null,
        input.actorScope,
        input.actorName,
        input.actorRole,
        input.action,
        input.targetType,
        input.targetId,
        input.result,
        input.detail,
        input.createdAt,
    ]);
}
async function createAuditLogEntry(input) {
    return (0, transaction_1.withTransaction)(async (client) => {
        await insertAuditLog(client, {
            id: (0, _shared_1.createId)("audit"),
            ...input,
            createdAt: input.createdAt ?? (0, _shared_1.formatLocalTimestamp)(),
        });
    });
}
