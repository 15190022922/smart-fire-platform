import type { PoolClient } from "pg";
import { createNotificationRecordsForAlarm } from "../../packages/database/src/repositories/notification-repository";
import { recordNotificationFailure } from "../../apps/backend/src/lib/runtime-metrics";

export async function dispatchAlarmNotifications(
  client: PoolClient,
  input: {
    tenantId: string;
    alarmId: string;
    deviceId: string;
    level: "alarm" | "fault";
    content: string;
    createdAt: string;
  },
) {
  const forceFailure = process.env.NOTIFICATION_FORCE_FAIL === "1" || input.content.includes("[FORCE_NOTIFY_FAIL]");

  const created = await createNotificationRecordsForAlarm(client, {
    tenantId: input.tenantId,
    alarmId: input.alarmId,
    deviceId: input.deviceId,
    level: input.level,
    content: input.content,
    createdAt: input.createdAt,
    forceFailure,
  });

  if (forceFailure) {
    recordNotificationFailure("forced_notification_failure");
  }

  return created;
}
