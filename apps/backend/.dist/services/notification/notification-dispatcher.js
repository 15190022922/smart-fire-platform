"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchAlarmNotifications = dispatchAlarmNotifications;
function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
async function dispatchAlarmNotifications(client, input) {
    const templates = await client.query(`
      SELECT id, channel, target_roles
      FROM notification_templates
      WHERE tenant_id = $1 AND enabled = TRUE AND level = $2
    `, [input.tenantId, input.level]);
    const rows = templates.rows.length > 0
        ? templates.rows.flatMap((template) => (template.target_roles ?? []).map((role) => ({
            templateId: template.id,
            channel: template.channel,
            targetRole: role,
        })))
        : [{ templateId: null, channel: "station", targetRole: "tenant_level_1" }];
    for (const row of rows) {
        await client.query(`
        INSERT INTO notification_records (
          id, tenant_id, alarm_id, device_id, template_id, notify_type, channel, level,
          target_name, target_role, target_user, content, status, retry_count, last_error, created_at, updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      `, [
            createId("notify"),
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
            "sent",
            0,
            "",
            input.createdAt,
            input.createdAt,
        ]);
    }
    return rows.length > 0;
}
