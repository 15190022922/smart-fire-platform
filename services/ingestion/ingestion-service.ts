import { withTransaction } from "../../packages/database/src/transaction";
import { insertAuditLog } from "../../packages/database/src/repositories/audit-repository";
import {
  createTenantAlarm,
  insertAlarmLog,
} from "../../packages/database/src/repositories/alarms-repository";
import {
  getTenantDeviceById,
  updateTenantDeviceRuntime,
  upsertDeviceStatusSnapshot,
} from "../../packages/database/src/repositories/devices-repository";
import { insertRawDeviceEventIfNew } from "../../packages/database/src/repositories/raw-events-repository";
import { publishTenantEvent } from "../../packages/realtime/src/server";
import { resolveRuntimeStatusFromAlarmTypeText } from "../../packages/shared/src/legacy-text";
import { runAlarmEngine } from "../alarm-engine/alarm-engine";
import { dispatchAlarmNotifications } from "../notification/notification-dispatcher";
import { recordAlarmGenerationSample, recordIngestionHit, recordRuntimeError } from "../../apps/backend/src/lib/runtime-metrics";
import type { IngestionEventPayload, IngestionProcessResult } from "./ingestion-types";

type DeviceRow = {
  id: string;
  tenant_id: string;
  name: string;
  area: string;
  installation_location: string;
  gateway_id: string | null;
  lifecycle_status?: string | null;
};

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
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
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value])) as Record<string, string>;
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function buildDedupeKey(input: IngestionEventPayload) {
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

function toEventLevel(eventType: IngestionEventPayload["event_type"]) {
  if (eventType === "alarm") return "critical";
  if (eventType === "fault" || eventType === "offline") return "warning";
  return "info";
}

function mapDeviceStatusText(status: "normal" | "alarm" | "fault" | "offline") {
  if (status === "alarm") return "\u62a5\u8b66";
  if (status === "fault") return "\u6545\u969c";
  if (status === "offline") return "\u79bb\u7ebf";
  return "\u6b63\u5e38";
}

function resolveStatusFromAlarmType(alarmType: string): "normal" | "alarm" | "fault" | "offline" {
  const runtimeStatus = resolveRuntimeStatusFromAlarmTypeText(alarmType);
  return runtimeStatus === "maintenance" ? "normal" : runtimeStatus;
}

export async function processIngestionEvent(input: IngestionEventPayload): Promise<IngestionProcessResult> {
  const startedAt = Date.now();
  const processedAt = formatLocalTimestamp(new Date(input.event_time));
  const rawEventId = createId("raw");
  const dedupeKey = buildDedupeKey(input);
  const protocol = input.protocol ?? "http";
  const eventValue = typeof input.event_value === "object" ? input.event_value : { value: input.event_value };
  let realtimeEventCode: string = input.event_type;

  try {
    const result = await withTransaction<IngestionProcessResult>(async (client) => {
      const device = (await getTenantDeviceById(client, input.tenant_id, input.device_id)) as DeviceRow | null;
      if (!device) {
        throw new Error("DEVICE_NOT_FOUND");
      }

      if (device.lifecycle_status === "disabled") {
        const inserted = await insertRawDeviceEventIfNew(client, {
          id: rawEventId,
          tenantId: input.tenant_id,
          deviceId: input.device_id,
          gatewayId: input.gateway_id ?? device.gateway_id,
          eventId: input.event_id ?? null,
          dedupeKey,
          protocol,
          eventType: input.event_type,
          eventCode: "DEVICE_DISABLED_IGNORED",
          eventLevel: "info",
          payload: { ...eventValue, source: input.source ?? "device_ingestion", ignoredReason: "device_disabled" },
          rawPayload: input.raw_payload ?? eventValue,
          processingStatus: "ignored",
          processedAt,
          reportedAt: processedAt,
        });

        if (inserted) {
          await insertAuditLog(client, {
            id: createId("audit"),
            tenantId: input.tenant_id,
            actorScope: "platform",
            actorName: "device_ingestion",
            actorRole: "device_ingestion",
            action: "device.event.ignored",
            targetType: "device",
            targetId: input.device_id,
            result: "success",
            detail: "设备已停用，事件已保留但未更新实时状态",
            createdAt: processedAt,
          });
        }

        realtimeEventCode = "DEVICE_DISABLED_IGNORED";
        return {
          success: true,
          raw_event_id: rawEventId,
          alarm_id: null,
          device_status: "ignored",
          workflow: {
            alarm_created: false,
            notification_created: false,
            realtime_published: false,
            duplicate_suppressed: !inserted,
            ignored_due_to_disabled: true,
          },
          processed_at: processedAt,
        };
      }

      const engineStartedAt = Date.now();
      const engine = await runAlarmEngine({
        client,
        tenantId: input.tenant_id,
        deviceId: input.device_id,
        deviceName: device.name,
        deviceLocation: `${device.area} / ${device.installation_location}`,
        reportedAt: processedAt,
        eventType: input.event_type as IngestionEventPayload["event_type"],
        eventValue: input.event_value,
      });
      recordAlarmGenerationSample(Date.now() - engineStartedAt);
      realtimeEventCode = engine.decision.eventCode;

      const inserted = await insertRawDeviceEventIfNew(client, {
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
      let alarmId: string | null = null;
      let alarmCreated = false;
      let notificationCreated = false;

      if (input.event_type === "heartbeat" && engine.activeAlarm) {
        nextStatus = resolveStatusFromAlarmType(engine.activeAlarm.alarm_type);
      }

      await upsertDeviceStatusSnapshot(client, {
        deviceId: input.device_id,
        tenantId: input.tenant_id,
        gatewayId: input.gateway_id ?? device.gateway_id,
        status: nextStatus,
        eventType: input.event_type,
        eventCode: engine.decision.eventCode,
        reportedAt: processedAt,
      });

      await updateTenantDeviceRuntime(client, {
        tenantId: input.tenant_id,
        deviceId: input.device_id,
        statusText: mapDeviceStatusText(nextStatus),
        pointStatusStyle: nextStatus,
        reportedAt: processedAt,
      });

      if (engine.decision.shouldCreateAlarm) {
        alarmId = createId("alarm");
          alarmCreated = true;

          await createTenantAlarm(client, {
            id: alarmId,
            tenantId: input.tenant_id,
            deviceId: input.device_id,
            deviceName: device.name,
            location: `${device.area} / ${device.installation_location}`,
            alarmType: engine.decision.alarmTypeLabel,
            time: processedAt,
          });

          await insertAlarmLog(client, {
            tenantId: input.tenant_id,
            alarmId,
            action: engine.decision.alarmLogAction,
            fromStatus: "未处理",
            toStatus: "未处理",
            operatorName: "device_ingestion",
            operatorRole: "device_ingestion",
            note: `${engine.decision.alarmTypeLabel} 已进入闭环流程`,
            createdAt: processedAt,
          });

          try {
            notificationCreated = await dispatchAlarmNotifications(client, {
              tenantId: input.tenant_id,
              alarmId,
              deviceId: input.device_id,
              level: input.event_type === "fault" ? "fault" : "alarm",
              content: `${device.name} ${engine.decision.alarmTypeLabel}，时间 ${processedAt}`,
              createdAt: processedAt,
            });
          } catch (error) {
            recordRuntimeError("notification_dispatch", error instanceof Error ? error.message : String(error));
          }

          await insertAuditLog(client, {
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
      } else if (input.event_type === "recovery" && engine.activeAlarm) {
        alarmId = engine.activeAlarm.id;
        await insertAlarmLog(client, {
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

        await insertAuditLog(client, {
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

      await insertAuditLog(client, {
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

      await insertAuditLog(client, {
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
        await insertAuditLog(client, {
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
          duplicate_suppressed: false,
        },
        processed_at: processedAt,
      };
    });

    try {
      if (result.workflow.ignored_due_to_disabled) {
        return result;
      }

      const realtimeType = result.workflow.alarm_created
        ? "alarm_created"
        : result.alarm_id && (input.event_type === "alarm" || input.event_type === "fault" || input.event_type === "recovery")
          ? "alarm_updated"
          : input.event_type === "heartbeat"
            ? "heartbeat"
            : "device_status_changed";
      publishTenantEvent(input.tenant_id, {
        type: realtimeType,
        tenantId: input.tenant_id,
        deviceId: input.device_id,
        alarmId: result.alarm_id,
        eventType: input.event_type,
        eventCode: realtimeEventCode,
        duplicateSuppressed: Boolean(result.workflow.duplicate_suppressed),
        reportedAt: processedAt,
        occurredAt: processedAt,
        source: input.source ?? "device_ingestion",
      });
      result.workflow.realtime_published = true;
    } catch (error) {
      recordRuntimeError("realtime_publish", error instanceof Error ? error.message : String(error));
    }

    return result;
  } catch (error) {
    recordRuntimeError("ingestion", error instanceof Error ? error.message : String(error));
    throw error;
  } finally {
    recordIngestionHit(Date.now() - startedAt);
  }
}
