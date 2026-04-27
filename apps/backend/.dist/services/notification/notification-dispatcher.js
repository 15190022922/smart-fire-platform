"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchAlarmNotifications = dispatchAlarmNotifications;
const notification_repository_1 = require("../../packages/database/src/repositories/notification-repository");
const runtime_metrics_1 = require("../../apps/backend/src/lib/runtime-metrics");
async function dispatchAlarmNotifications(client, input) {
    const forceFailure = process.env.NOTIFICATION_FORCE_FAIL === "1" || input.content.includes("[FORCE_NOTIFY_FAIL]");
    const created = await (0, notification_repository_1.createNotificationRecordsForAlarm)(client, {
        tenantId: input.tenantId,
        alarmId: input.alarmId,
        deviceId: input.deviceId,
        level: input.level,
        content: input.content,
        createdAt: input.createdAt,
        forceFailure,
    });
    if (forceFailure) {
        (0, runtime_metrics_1.recordNotificationFailure)("forced_notification_failure");
    }
    return created;
}
