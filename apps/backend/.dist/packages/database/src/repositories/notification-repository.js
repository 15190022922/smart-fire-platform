"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTenantNotificationCenterData = getTenantNotificationCenterData;
exports.retryNotificationRecord = retryNotificationRecord;
exports.createNotificationRecordsForAlarm = createNotificationRecordsForAlarm;
const client_1 = require("../client");
const errors_1 = require("../errors");
const _shared_1 = require("./_shared");
async function getTenantNotificationCenterData(tenantId) {
    (0, errors_1.assertTenantId)(tenantId);
    const [templates, records] = await Promise.all([
        (0, client_1.queryDb)("SELECT * FROM notification_templates WHERE tenant_id = $1 ORDER BY updated_at DESC", [tenantId]),
        (0, client_1.queryDb)("SELECT * FROM notification_records WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 300", [tenantId]),
    ]);
    return {
        templates: templates.rows.map(_shared_1.mapNotificationTemplate),
        records: records.rows.map(_shared_1.mapNotificationRecord),
    };
}
async function retryNotificationRecord(executor, tenantId, recordId, now) {
    (0, errors_1.assertTenantId)(tenantId);
    await executor.query(`UPDATE notification_records
     SET status = 'sent',
         retry_count = retry_count + 1,
         last_error = '',
         updated_at = $1
     WHERE tenant_id = $2 AND id = $3`, [now, tenantId, recordId]);
}
async function createNotificationRecordsForAlarm(executor, input) {
    (0, errors_1.assertTenantId)(input.tenantId);
    const templates = await executor.query(`SELECT id, channel, target_roles
     FROM notification_templates
     WHERE tenant_id = $1 AND enabled = TRUE AND level = $2`, [input.tenantId, input.level]);
    const rows = templates.rows.length > 0
        ? templates.rows.flatMap((template) => (0, _shared_1.jsonStringArray)(template.target_roles).map((role) => ({
            templateId: template.id,
            channel: template.channel,
            targetRole: role,
        })))
        : [{ templateId: null, channel: "station", targetRole: "tenant_level_1" }];
    for (const row of rows) {
        await executor.query(`
        INSERT INTO notification_records (
          id, tenant_id, alarm_id, device_id, template_id, notify_type, channel, level,
          target_name, target_role, target_user, content, status, retry_count, last_error, created_at, updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      `, [
            (0, _shared_1.createId)("notify"),
            input.tenantId,
            input.alarmId,
            input.deviceId,
            row.templateId,
            row.channel === "sms" ? "sms" : "station",
            row.channel,
            input.level,
            row.targetRole,
            row.targetRole,
            "",
            input.content,
            input.forceFailure ? "failed" : "sent",
            0,
            input.forceFailure ? "forced_notification_failure" : "",
            input.createdAt,
            input.createdAt,
        ]);
    }
    return rows.length > 0;
}
