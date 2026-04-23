"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processIngestionEvent = processIngestionEvent;
const db_1 = require("../../lib/db");
const alarm_engine_1 = require("../alarm-engine/alarm-engine");
const notification_dispatcher_1 = require("../notification/notification-dispatcher");
const server_1 = require("../../packages/realtime/src/server");
function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
        return "报警";
    if (status === "fault")
        return "故障";
    if (status === "offline")
        return "离线";
    return "正常";
}
function mapPointStatusStyle(status) {
    return status;
}
function resolveStatusFromAlarmType(alarmType) {
    if (alarmType.includes("火警") || alarmType.includes("报警"))
        return "alarm";
    if (alarmType.includes("故障"))
        return "fault";
    if (alarmType.includes("离线"))
        return "offline";
    return "normal";
}
async function insertAuditLog(client, input) {
    await client.query(`
      INSERT INTO audit_logs (
        id, tenant_id, actor_scope, actor_name, actor_role, action, target_type, target_id, result, detail, created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    `, [
        createId("audit"),
        input.tenantId,
        "platform",
        "device_ingestion",
        "device_ingestion",
        input.action,
        input.targetType,
        input.targetId,
        "success",
        input.detail,
        input.createdAt,
    ]);
}
async function insertAlarmLog(client, input) {
    await client.query(`
      INSERT INTO alarm_logs (
        id, tenant_id, alarm_id, action, from_status, to_status, operator_name, operator_role, note, attachments, created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)
    `, [
        createId("alarm-log"),
        input.tenantId,
        input.alarmId,
        input.action,
        input.fromStatus,
        input.toStatus,
        "设备接入服务",
        "device_ingestion",
        input.note,
        JSON.stringify([]),
        input.createdAt,
    ]);
}
async function updateDeviceRuntime(client, input) {
    await client.query(`
      INSERT INTO device_status_snapshots (
        device_id, tenant_id, gateway_id, status, last_event_type, last_event_code, last_reported_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (device_id) DO UPDATE SET
        gateway_id = COALESCE(EXCLUDED.gateway_id, device_status_snapshots.gateway_id),
        status = EXCLUDED.status,
        last_event_type = EXCLUDED.last_event_type,
        last_event_code = EXCLUDED.last_event_code,
        last_reported_at = EXCLUDED.last_reported_at,
        updated_at = EXCLUDED.updated_at
    `, [
        input.deviceId,
        input.tenantId,
        input.gatewayId ?? null,
        input.status,
        input.eventType,
        input.eventCode,
        input.reportedAt,
        input.reportedAt,
    ]);
    await client.query("UPDATE tenant_devices SET status = $1, last_report_at = $2 WHERE tenant_id = $3 AND id = $4", [mapDeviceStatusText(input.status), input.reportedAt, input.tenantId, input.deviceId]);
    await client.query("UPDATE tenant_device_points SET status_style = $1, updated_at = $2 WHERE tenant_id = $3 AND device_id = $4", [mapPointStatusStyle(input.status), input.reportedAt, input.tenantId, input.deviceId]);
}
async function processIngestionEvent(input) {
    await (0, db_1.ensureDatabase)();
    const processedAt = (0, db_1.formatLocalTimestamp)(new Date(input.event_time));
    const rawEventId = createId("raw");
    const eventValue = typeof input.event_value === "object" ? input.event_value : { value: input.event_value };
    let result = null;
    await (0, db_1.withClient)(async (client) => {
        await client.query("BEGIN");
        try {
            const deviceQuery = await client.query(`
          SELECT id, tenant_id, name, area, installation_location, gateway_id
          FROM tenant_devices
          WHERE tenant_id = $1 AND id = $2
          LIMIT 1
        `, [input.tenant_id, input.device_id]);
            const device = deviceQuery.rows[0];
            if (!device) {
                throw new Error("DEVICE_NOT_FOUND");
            }
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
            let nextStatus = engine.decision.nextDeviceStatus;
            let alarmId = null;
            let alarmCreated = false;
            let notificationCreated = false;
            if (input.event_type === "heartbeat" && engine.activeAlarm) {
                nextStatus = resolveStatusFromAlarmType(engine.activeAlarm.alarm_type);
            }
            await client.query(`
          INSERT INTO raw_device_events (
            id, tenant_id, device_id, gateway_id, event_type, event_code, event_level, payload, reported_at
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
        `, [
                rawEventId,
                input.tenant_id,
                input.device_id,
                input.gateway_id ?? device.gateway_id,
                input.event_type,
                engine.decision.eventCode,
                toEventLevel(input.event_type),
                JSON.stringify({
                    ...eventValue,
                    source: input.source ?? "device_ingestion",
                }),
                processedAt,
            ]);
            await updateDeviceRuntime(client, {
                tenantId: input.tenant_id,
                deviceId: input.device_id,
                gatewayId: input.gateway_id ?? device.gateway_id,
                eventType: input.event_type,
                eventCode: engine.decision.eventCode,
                status: nextStatus,
                reportedAt: processedAt,
            });
            if (engine.decision.shouldCreateAlarm) {
                if (!engine.hasOpenAlarm) {
                    alarmId = createId("alarm");
                    alarmCreated = true;
                    await client.query(`
              INSERT INTO tenant_alarms (
                id, tenant_id, device_id, device_name, location, alarm_type, time,
                process_status, workflow_status, detail_note, attachments, false_alarm,
                assigned_user_name, last_operator_name, closed_reason
              )
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15)
            `, [
                        alarmId,
                        input.tenant_id,
                        input.device_id,
                        device.name,
                        `${device.area} / ${device.installation_location}`,
                        engine.decision.alarmTypeLabel,
                        processedAt,
                        "未处理",
                        "未处理",
                        "",
                        JSON.stringify([]),
                        false,
                        "",
                        "设备接入服务",
                        "",
                    ]);
                    await insertAlarmLog(client, {
                        tenantId: input.tenant_id,
                        alarmId,
                        action: engine.decision.alarmLogAction,
                        fromStatus: "未处理",
                        toStatus: "未处理",
                        note: `${engine.decision.alarmTypeLabel} 已进入闭环流程`,
                        createdAt: processedAt,
                    });
                    notificationCreated = await (0, notification_dispatcher_1.dispatchAlarmNotifications)(client, {
                        tenantId: input.tenant_id,
                        alarmId,
                        deviceId: input.device_id,
                        level: input.event_type === "fault" ? "fault" : "alarm",
                        content: `${device.name} ${engine.decision.alarmTypeLabel}，时间 ${processedAt}`,
                        createdAt: processedAt,
                    });
                    await insertAuditLog(client, {
                        tenantId: input.tenant_id,
                        action: "alarm.created",
                        targetType: "alarm",
                        targetId: alarmId,
                        detail: `${engine.decision.alarmTypeLabel} 已创建`,
                        createdAt: processedAt,
                    });
                }
                else {
                    alarmId = engine.activeAlarm?.id ?? null;
                    if (alarmId) {
                        await insertAlarmLog(client, {
                            tenantId: input.tenant_id,
                            alarmId,
                            action: "重复事件",
                            fromStatus: engine.activeAlarm.workflow_status,
                            toStatus: engine.activeAlarm.workflow_status,
                            note: `${engine.decision.alarmTypeLabel} 再次上报，未重复创建报警`,
                            createdAt: processedAt,
                        });
                    }
                }
            }
            else if (input.event_type === "recovery" && engine.activeAlarm) {
                alarmId = engine.activeAlarm.id;
                await insertAlarmLog(client, {
                    tenantId: input.tenant_id,
                    alarmId,
                    action: "恢复事件",
                    fromStatus: engine.activeAlarm.workflow_status,
                    toStatus: engine.activeAlarm.workflow_status,
                    note: "设备上报恢复事件，正式报警保持人工闭环",
                    createdAt: processedAt,
                });
                await insertAuditLog(client, {
                    tenantId: input.tenant_id,
                    action: "alarm.recovery.logged",
                    targetType: "alarm",
                    targetId: alarmId,
                    detail: "设备恢复事件已记录，报警未自动关闭",
                    createdAt: processedAt,
                });
            }
            await insertAuditLog(client, {
                tenantId: input.tenant_id,
                action: "device.event.ingested",
                targetType: "device",
                targetId: input.device_id,
                detail: `${input.event_type}/${engine.decision.eventCode} -> ${nextStatus}`,
                createdAt: processedAt,
            });
            await insertAuditLog(client, {
                tenantId: input.tenant_id,
                action: "device.status.updated",
                targetType: "device_status",
                targetId: input.device_id,
                detail: `设备状态更新为 ${nextStatus}`,
                createdAt: processedAt,
            });
            if (notificationCreated) {
                await insertAuditLog(client, {
                    tenantId: input.tenant_id,
                    action: "notification.triggered",
                    targetType: "notification",
                    targetId: alarmId ?? input.device_id,
                    detail: "通知记录已生成",
                    createdAt: processedAt,
                });
            }
            await client.query("COMMIT");
            const realtimeType = alarmCreated
                ? "alarm_created"
                : engine.decision.shouldPublishRealtimeType;
            (0, server_1.publishTenantEvent)(input.tenant_id, {
                type: realtimeType,
                tenantId: input.tenant_id,
                deviceId: input.device_id,
                alarmId,
                eventType: input.event_type,
                eventCode: engine.decision.eventCode,
                reportedAt: processedAt,
                occurredAt: processedAt,
                source: input.source ?? "device_ingestion",
            });
            result = {
                success: true,
                raw_event_id: rawEventId,
                alarm_id: alarmId,
                device_status: nextStatus,
                workflow: {
                    alarm_created: alarmCreated,
                    notification_created: notificationCreated,
                    realtime_published: true,
                },
                processed_at: processedAt,
            };
        }
        catch (error) {
            await client.query("ROLLBACK");
            throw error;
        }
    });
    if (!result) {
        throw new Error("INGESTION_PROCESS_FAILED");
    }
    return result;
}
