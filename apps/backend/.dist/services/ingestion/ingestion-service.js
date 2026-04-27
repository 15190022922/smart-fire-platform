"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processIngestionEvent = processIngestionEvent;
const transaction_1 = require("../../packages/database/src/transaction");
const audit_repository_1 = require("../../packages/database/src/repositories/audit-repository");
const alarms_repository_1 = require("../../packages/database/src/repositories/alarms-repository");
const devices_repository_1 = require("../../packages/database/src/repositories/devices-repository");
const raw_events_repository_1 = require("../../packages/database/src/repositories/raw-events-repository");
const server_1 = require("../../packages/realtime/src/server");
const alarm_engine_1 = require("../alarm-engine/alarm-engine");
const notification_dispatcher_1 = require("../notification/notification-dispatcher");
const runtime_metrics_1 = require("../../apps/backend/src/lib/runtime-metrics");
function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function stableStringify(value) {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(",")}]`;
    }
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}
function formatLocalTimestamp(date = new Date(), timeZone = "Asia/Shanghai") {
    const formatter = new Intl.DateTimeFormat("sv-SE", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
    const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}
function buildDedupeKey(input) {
    if (input.event_id?.trim()) {
        return `event-id:${input.tenant_id}:${input.device_id}:${input.event_id.trim()}`;
    }
    return [
        input.tenant_id,
        input.device_id,
        input.gateway_id ?? "",
        input.protocol ?? "http",
        input.event_type,
        new Date(input.event_time).toISOString(),
        stableStringify(input.event_value),
    ].join("|");
}
function toEventLevel(eventType) {
    if (eventType === "alarm")
        return "critical";
    if (eventType === "fault" || eventType === "offline")
        return "warning";
    return "info";
}
function mapDeviceStatusText(status) {
    if (status === "alarm")
        return "鎶ヨ";
    if (status === "fault")
        return "鏁呴殰";
    if (status === "offline")
        return "绂荤嚎";
    return "姝ｅ父";
}
function resolveStatusFromAlarmType(alarmType) {
    if (alarmType.includes("鐏") || alarmType.includes("鎶ヨ") || alarmType.includes("閻忣偉顒?"))
        return "alarm";
    if (alarmType.includes("鏁呴殰") || alarmType.includes("閺佸懘娈?"))
        return "fault";
    if (alarmType.includes("绂荤嚎") || alarmType.includes("缁傝崵鍤?"))
        return "offline";
    return "normal";
}
async function processIngestionEvent(input) {
    const startedAt = Date.now();
    const processedAt = formatLocalTimestamp(new Date(input.event_time));
    const rawEventId = createId("raw");
    const dedupeKey = buildDedupeKey(input);
    const protocol = input.protocol ?? "http";
    const eventValue = typeof input.event_value === "object" ? input.event_value : { value: input.event_value };
    let realtimeEventCode = input.event_type;
    try {
        const result = await (0, transaction_1.withTransaction)(async (client) => {
            const device = (await (0, devices_repository_1.getTenantDeviceById)(client, input.tenant_id, input.device_id));
            if (!device) {
                throw new Error("DEVICE_NOT_FOUND");
            }
            const engineStartedAt = Date.now();
            const engine = await (0, alarm_engine_1.runAlarmEngine)({
                client,
                tenantId: input.tenant_id,
                deviceId: input.device_id,
                deviceName: device.name,
                deviceLocation: `${device.area} / ${device.installation_location}`,
                reportedAt: processedAt,
                eventType: input.event_type,
                eventValue: input.event_value,
            });
            (0, runtime_metrics_1.recordAlarmGenerationSample)(Date.now() - engineStartedAt);
            realtimeEventCode = engine.decision.eventCode;
            const inserted = await (0, raw_events_repository_1.insertRawDeviceEventIfNew)(client, {
                id: rawEventId,
                tenantId: input.tenant_id,
                deviceId: input.device_id,
                gatewayId: input.gateway_id ?? device.gateway_id,
                eventId: input.event_id ?? null,
                dedupeKey,
                protocol,
                eventType: input.event_type,
                eventCode: engine.decision.eventCode,
                eventLevel: toEventLevel(input.event_type),
                payload: { ...eventValue, source: input.source ?? "device_ingestion" },
                rawPayload: input.raw_payload ?? eventValue,
                processingStatus: "processed",
                processedAt,
                reportedAt: processedAt,
            });
            if (!inserted) {
                return {
                    success: true,
                    raw_event_id: rawEventId,
                    alarm_id: engine.activeAlarm?.id ?? null,
                    device_status: engine.activeAlarm
                        ? resolveStatusFromAlarmType(engine.activeAlarm.alarm_type)
                        : engine.decision.nextDeviceStatus,
                    workflow: {
                        alarm_created: false,
                        notification_created: false,
                        realtime_published: false,
                        duplicate_suppressed: true,
                    },
                    processed_at: processedAt,
                };
            }
            let nextStatus = engine.decision.nextDeviceStatus;
            let alarmId = null;
            let alarmCreated = false;
            let notificationCreated = false;
            if (input.event_type === "heartbeat" && engine.activeAlarm) {
                nextStatus = resolveStatusFromAlarmType(engine.activeAlarm.alarm_type);
            }
            await (0, devices_repository_1.upsertDeviceStatusSnapshot)(client, {
                deviceId: input.device_id,
                tenantId: input.tenant_id,
                gatewayId: input.gateway_id ?? device.gateway_id,
                status: nextStatus,
                eventType: input.event_type,
                eventCode: engine.decision.eventCode,
                reportedAt: processedAt,
            });
            await (0, devices_repository_1.updateTenantDeviceRuntime)(client, {
                tenantId: input.tenant_id,
                deviceId: input.device_id,
                statusText: mapDeviceStatusText(nextStatus),
                pointStatusStyle: nextStatus,
                reportedAt: processedAt,
            });
            if (engine.decision.shouldCreateAlarm) {
                if (!engine.hasOpenAlarm) {
                    alarmId = createId("alarm");
                    alarmCreated = true;
                    await (0, alarms_repository_1.createTenantAlarm)(client, {
                        id: alarmId,
                        tenantId: input.tenant_id,
                        deviceId: input.device_id,
                        deviceName: device.name,
                        location: `${device.area} / ${device.installation_location}`,
                        alarmType: engine.decision.alarmTypeLabel,
                        time: processedAt,
                    });
                    await (0, alarms_repository_1.insertAlarmLog)(client, {
                        tenantId: input.tenant_id,
                        alarmId,
                        action: engine.decision.alarmLogAction,
                        fromStatus: "鏈鐞?",
                        toStatus: "鏈鐞?",
                        operatorName: "device_ingestion",
                        operatorRole: "device_ingestion",
                        note: `${engine.decision.alarmTypeLabel} 已进入闭环流程`,
                        createdAt: processedAt,
                    });
                    try {
                        notificationCreated = await (0, notification_dispatcher_1.dispatchAlarmNotifications)(client, {
                            tenantId: input.tenant_id,
                            alarmId,
                            deviceId: input.device_id,
                            level: input.event_type === "fault" ? "fault" : "alarm",
                            content: `${device.name} ${engine.decision.alarmTypeLabel}，时间 ${processedAt}`,
                            createdAt: processedAt,
                        });
                    }
                    catch (error) {
                        (0, runtime_metrics_1.recordRuntimeError)("notification_dispatch", error instanceof Error ? error.message : String(error));
                    }
                    await (0, audit_repository_1.insertAuditLog)(client, {
                        id: createId("audit"),
                        tenantId: input.tenant_id,
                        actorScope: "platform",
                        actorName: "device_ingestion",
                        actorRole: "device_ingestion",
                        action: "alarm.created",
                        targetType: "alarm",
                        targetId: alarmId ?? input.device_id,
                        result: "success",
                        detail: `${engine.decision.alarmTypeLabel} 已创建`,
                        createdAt: processedAt,
                    });
                }
                else {
                    alarmId = engine.activeAlarm?.id ?? null;
                    if (alarmId) {
                        await (0, alarms_repository_1.insertAlarmLog)(client, {
                            tenantId: input.tenant_id,
                            alarmId,
                            action: "重复事件",
                            fromStatus: engine.activeAlarm.workflow_status,
                            toStatus: engine.activeAlarm.workflow_status,
                            operatorName: "device_ingestion",
                            operatorRole: "device_ingestion",
                            note: `${engine.decision.alarmTypeLabel} 再次上报，未重复创建报警`,
                            createdAt: processedAt,
                        });
                    }
                }
            }
            else if (input.event_type === "recovery" && engine.activeAlarm) {
                alarmId = engine.activeAlarm.id;
                await (0, alarms_repository_1.insertAlarmLog)(client, {
                    tenantId: input.tenant_id,
                    alarmId: engine.activeAlarm.id,
                    action: "恢复事件",
                    fromStatus: engine.activeAlarm.workflow_status,
                    toStatus: engine.activeAlarm.workflow_status,
                    operatorName: "device_ingestion",
                    operatorRole: "device_ingestion",
                    note: "设备上报恢复事件，正式报警保持人工闭环",
                    createdAt: processedAt,
                });
                await (0, audit_repository_1.insertAuditLog)(client, {
                    id: createId("audit"),
                    tenantId: input.tenant_id,
                    actorScope: "platform",
                    actorName: "device_ingestion",
                    actorRole: "device_ingestion",
                    action: "alarm.recovery.logged",
                    targetType: "alarm",
                    targetId: alarmId ?? input.device_id,
                    result: "success",
                    detail: "设备恢复事件已记录，正式报警未自动关闭",
                    createdAt: processedAt,
                });
            }
            await (0, audit_repository_1.insertAuditLog)(client, {
                id: createId("audit"),
                tenantId: input.tenant_id,
                actorScope: "platform",
                actorName: "device_ingestion",
                actorRole: "device_ingestion",
                action: "device.event.ingested",
                targetType: "device",
                targetId: input.device_id,
                result: "success",
                detail: `${input.event_type}/${engine.decision.eventCode} -> ${nextStatus}`,
                createdAt: processedAt,
            });
            await (0, audit_repository_1.insertAuditLog)(client, {
                id: createId("audit"),
                tenantId: input.tenant_id,
                actorScope: "platform",
                actorName: "device_ingestion",
                actorRole: "device_ingestion",
                action: "device.status.updated",
                targetType: "device_status",
                targetId: input.device_id,
                result: "success",
                detail: `设备状态更新为 ${nextStatus}`,
                createdAt: processedAt,
            });
            if (notificationCreated) {
                await (0, audit_repository_1.insertAuditLog)(client, {
                    id: createId("audit"),
                    tenantId: input.tenant_id,
                    actorScope: "platform",
                    actorName: "device_ingestion",
                    actorRole: "device_ingestion",
                    action: "notification.triggered",
                    targetType: "notification",
                    targetId: alarmId ?? input.device_id,
                    result: "success",
                    detail: "通知记录已生成",
                    createdAt: processedAt,
                });
            }
            return {
                success: true,
                raw_event_id: rawEventId,
                alarm_id: alarmId,
                device_status: nextStatus,
                workflow: {
                    alarm_created: alarmCreated,
                    notification_created: notificationCreated,
                    realtime_published: false,
                },
                processed_at: processedAt,
            };
        });
        try {
            const realtimeType = result.workflow.alarm_created
                ? "alarm_created"
                : input.event_type === "heartbeat"
                    ? "heartbeat"
                    : input.event_type === "recovery"
                        ? "alarm_updated"
                        : "device_status_changed";
            (0, server_1.publishTenantEvent)(input.tenant_id, {
                type: realtimeType,
                tenantId: input.tenant_id,
                deviceId: input.device_id,
                alarmId: result.alarm_id,
                eventType: input.event_type,
                eventCode: realtimeEventCode,
                reportedAt: processedAt,
                occurredAt: processedAt,
                source: input.source ?? "device_ingestion",
            });
            result.workflow.realtime_published = true;
        }
        catch (error) {
            (0, runtime_metrics_1.recordRuntimeError)("realtime_publish", error instanceof Error ? error.message : String(error));
        }
        return result;
    }
    catch (error) {
        (0, runtime_metrics_1.recordRuntimeError)("ingestion", error instanceof Error ? error.message : String(error));
        throw error;
    }
    finally {
        (0, runtime_metrics_1.recordIngestionHit)(Date.now() - startedAt);
    }
}
