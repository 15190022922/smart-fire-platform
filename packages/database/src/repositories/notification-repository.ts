import type { DbExecutor } from "../client";
import { queryDb } from "../client";
import { assertTenantId } from "../errors";
import { createId, jsonStringArray, mapNotificationRecord, mapNotificationTemplate } from "./_shared";

export async function getTenantNotificationCenterData(tenantId: string) {
  assertTenantId(tenantId);
  const [templates, records] = await Promise.all([
    queryDb("SELECT * FROM notification_templates WHERE tenant_id = $1 ORDER BY updated_at DESC", [tenantId]),
    queryDb("SELECT * FROM notification_records WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 300", [tenantId]),
  ]);

  return {
    templates: templates.rows.map(mapNotificationTemplate),
    records: records.rows.map(mapNotificationRecord),
  };
}

export async function retryNotificationRecord(executor: DbExecutor, tenantId: string, recordId: string, now: string) {
  assertTenantId(tenantId);
  await executor.query(
    `UPDATE notification_records
     SET status = 'sent',
         retry_count = retry_count + 1,
         last_error = '',
         updated_at = $1
     WHERE tenant_id = $2 AND id = $3`,
    [now, tenantId, recordId],
  );
}

export async function createNotificationRecordsForAlarm(
  executor: DbExecutor,
  input: {
    tenantId: string;
    alarmId: string;
    deviceId: string;
    level: "alarm" | "fault";
    content: string;
    createdAt: string;
    forceFailure?: boolean;
  },
) {
  assertTenantId(input.tenantId);
  const templates = await executor.query<{
    id: string;
    channel: string;
    target_roles: string[] | string;
  }>(
    `SELECT id, channel, target_roles
     FROM notification_templates
     WHERE tenant_id = $1 AND enabled = TRUE AND level = $2`,
    [input.tenantId, input.level],
  );

  const rows =
    templates.rows.length > 0
      ? templates.rows.flatMap((template) =>
          jsonStringArray(template.target_roles).map((role) => ({
            templateId: template.id,
            channel: template.channel,
            targetRole: role,
          })),
        )
      : [{ templateId: null, channel: "station", targetRole: "tenant_level_1" }];

  for (const row of rows) {
    await executor.query(
      `
        INSERT INTO notification_records (
          id, tenant_id, alarm_id, device_id, template_id, notify_type, channel, level,
          target_name, target_role, target_user, content, status, retry_count, last_error, created_at, updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      `,
      [
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
        input.forceFailure ? "failed" : "sent",
        0,
        input.forceFailure ? "forced_notification_failure" : "",
        input.createdAt,
        input.createdAt,
      ],
    );
  }

  return rows.length > 0;
}
