import { publishTenantEvent } from "../../../realtime/src/server";
import type { DbExecutor } from "../client";
import { queryDb } from "../client";
import { assertTenantId } from "../errors";
import { withTransaction } from "../transaction";
import {
  ALARM_PROCESS_RESOLVED,
  ALARM_WORKFLOW_CLOSED,
  ALARM_WORKFLOW_COMPLETED,
  ALARM_WORKFLOW_CONFIRMED,
  ALARM_WORKFLOW_PENDING,
  ALARM_WORKFLOW_PROCESSING,
  createId,
  formatLocalTimestamp,
  jsonStringArray,
  mapAlarmCenterItem,
  mapRuntimeStatus,
  normalizeWorkflowStatus,
  resolveRuntimeStatusFromAlarmType,
} from "./_shared";
import { insertAuditLog } from "./audit-repository";

export async function listTenantAlarmCenterData(tenantId: string) {
  assertTenantId(tenantId);
  const [alarms, timelines] = await Promise.all([
    queryDb("SELECT * FROM tenant_alarms WHERE tenant_id = $1 ORDER BY time DESC, id DESC LIMIT 400", [tenantId]),
    queryDb("SELECT * FROM alarm_logs WHERE tenant_id = $1 ORDER BY created_at DESC", [tenantId]),
  ]);

  return alarms.rows.map((row) => mapAlarmCenterItem(row, timelines.rows));
}

export async function findOpenAlarmByDevice(executor: DbExecutor, tenantId: string, deviceId: string) {
  assertTenantId(tenantId);
  const openAlarms = await executor.query(
    `
      SELECT id, alarm_type, workflow_status, process_status
      FROM tenant_alarms
      WHERE tenant_id = $1
        AND device_id = $2
        AND COALESCE(workflow_status, process_status) NOT IN ($3, $4, '已完成', '已关闭')
      ORDER BY time DESC
    `,
    [tenantId, deviceId, ALARM_WORKFLOW_COMPLETED, ALARM_WORKFLOW_CLOSED],
  );
  return openAlarms.rows[0] ?? null;
}

export async function insertAlarmLog(
  executor: DbExecutor,
  input: {
    tenantId: string;
    alarmId: string;
    action: string;
    fromStatus: string;
    toStatus: string;
    operatorName: string;
    operatorRole: string;
    note: string;
    attachments?: string[];
    createdAt: string;
  },
) {
  assertTenantId(input.tenantId);
  await executor.query(
    `INSERT INTO alarm_logs (id, tenant_id, alarm_id, action, from_status, to_status, operator_name, operator_role, note, attachments, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
    [
      createId("alarm-log"),
      input.tenantId,
      input.alarmId,
      input.action,
      input.fromStatus,
      input.toStatus,
      input.operatorName,
      input.operatorRole,
      input.note,
      JSON.stringify(input.attachments ?? []),
      input.createdAt,
    ],
  );
}

export async function createTenantAlarm(
  executor: DbExecutor,
  input: {
    id: string;
    tenantId: string;
    deviceId: string;
    deviceName: string;
    location: string;
    alarmType: string;
    time: string;
  },
) {
  assertTenantId(input.tenantId);
  await executor.query(
    `INSERT INTO tenant_alarms (
      id, tenant_id, device_id, device_name, location, alarm_type, time,
      process_status, workflow_status, detail_note, attachments, false_alarm,
      assigned_user_name, last_operator_name, closed_reason
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15)`,
    [
      input.id,
      input.tenantId,
      input.deviceId,
      input.deviceName,
      input.location,
      input.alarmType,
      input.time,
      ALARM_WORKFLOW_PENDING,
      ALARM_WORKFLOW_PENDING,
      "",
      JSON.stringify([]),
      false,
      "",
      "device_ingestion",
      "",
    ],
  );
}

export async function syncDeviceRuntimeFromAlarms(
  executor: DbExecutor,
  tenantId: string,
  deviceId: string,
  reportedAt: string,
  gatewayId?: string | null,
) {
  assertTenantId(tenantId);
  const unresolved = await executor.query(
    `
      SELECT alarm_type
      FROM tenant_alarms
      WHERE tenant_id = $1
        AND device_id = $2
        AND COALESCE(process_status, workflow_status) NOT IN ($3, $4, '已处理', '已关闭', '已完成')
      ORDER BY time DESC
      LIMIT 1
    `,
    [tenantId, deviceId, ALARM_PROCESS_RESOLVED, ALARM_WORKFLOW_CLOSED],
  );

  const nextRuntimeStatus =
    unresolved.rowCount && unresolved.rows[0]?.alarm_type
      ? resolveRuntimeStatusFromAlarmType(String(unresolved.rows[0].alarm_type))
      : "normal";

  const mapped = mapRuntimeStatus(nextRuntimeStatus);

  await executor.query(
    `
      INSERT INTO device_status_snapshots (device_id, tenant_id, gateway_id, status, last_event_type, last_event_code, last_reported_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (device_id) DO UPDATE SET
        gateway_id = COALESCE(EXCLUDED.gateway_id, device_status_snapshots.gateway_id),
        status = EXCLUDED.status,
        last_event_type = EXCLUDED.last_event_type,
        last_event_code = EXCLUDED.last_event_code,
        last_reported_at = EXCLUDED.last_reported_at,
        updated_at = EXCLUDED.updated_at
    `,
    [deviceId, tenantId, gatewayId ?? null, mapped.runtimeStatus, "status_change", "ALARM_STATUS_SYNC", reportedAt, reportedAt],
  );

  await executor.query("UPDATE tenant_devices SET status = $1, last_report_at = $2 WHERE tenant_id = $3 AND id = $4", [
    mapped.deviceStatusText,
    reportedAt,
    tenantId,
    deviceId,
  ]);

  await executor.query(
    "UPDATE tenant_device_points SET status_style = $1, updated_at = $2 WHERE tenant_id = $3 AND device_id = $4",
    [mapped.pointStatusStyle, reportedAt, tenantId, deviceId],
  );

  return mapped;
}

export async function updateTenantAlarmWorkflow(
  tenantId: string,
  input: {
    alarmId: string;
    nextStatus: string;
    falseAlarm?: boolean;
    note?: string;
    attachments?: string[];
    assignedUserName?: string;
    operatorName: string;
    operatorRole: string;
  },
) {
  assertTenantId(tenantId);
  const now = formatLocalTimestamp();
  const result = await withTransaction(async (client) => {
    const alarm = await client.query("SELECT * FROM tenant_alarms WHERE tenant_id = $1 AND id = $2 LIMIT 1", [
      tenantId,
      input.alarmId,
    ]);
    if (alarm.rowCount === 0) {
      throw new Error("ALARM_NOT_FOUND");
    }

    const current = alarm.rows[0];
    const previousStatus = normalizeWorkflowStatus(current.workflow_status ?? current.process_status);
    const nextProcessStatus =
      input.nextStatus === ALARM_WORKFLOW_PROCESSING
        ? ALARM_WORKFLOW_PROCESSING
        : input.nextStatus === ALARM_WORKFLOW_COMPLETED || input.nextStatus === ALARM_WORKFLOW_CLOSED
          ? ALARM_PROCESS_RESOLVED
          : ALARM_WORKFLOW_PENDING;

    await client.query(
      `UPDATE tenant_alarms
       SET workflow_status = $1,
           process_status = $2,
           false_alarm = $3,
           detail_note = $4,
           attachments = $5::jsonb,
           assigned_user_name = $6,
           last_operator_name = $7,
           acknowledged_at = CASE WHEN $1 = $12 AND acknowledged_at IS NULL THEN $8 ELSE acknowledged_at END,
           processing_at = CASE WHEN $1 = $13 AND processing_at IS NULL THEN $8 ELSE processing_at END,
           completed_at = CASE WHEN $1 = $14 AND completed_at IS NULL THEN $8 ELSE completed_at END,
           closed_at = CASE WHEN $1 = $15 AND closed_at IS NULL THEN $8 ELSE closed_at END,
           closed_reason = $9
       WHERE tenant_id = $10 AND id = $11`,
      [
        input.nextStatus,
        nextProcessStatus,
        Boolean(input.falseAlarm),
        input.note ?? current.detail_note ?? "",
        JSON.stringify(input.attachments ?? jsonStringArray(current.attachments)),
        input.assignedUserName ?? current.assigned_user_name ?? "",
        input.operatorName,
        now,
        input.falseAlarm ? "误报关闭" : current.closed_reason ?? "",
        tenantId,
        input.alarmId,
        ALARM_WORKFLOW_CONFIRMED,
        ALARM_WORKFLOW_PROCESSING,
        ALARM_WORKFLOW_COMPLETED,
        ALARM_WORKFLOW_CLOSED,
      ],
    );

    await insertAlarmLog(client, {
      tenantId,
      alarmId: input.alarmId,
      action: input.falseAlarm ? "标记误报" : "状态流转",
      fromStatus: previousStatus,
      toStatus: input.nextStatus,
      operatorName: input.operatorName,
      operatorRole: input.operatorRole,
      note: input.note ?? "",
      attachments: input.attachments ?? [],
      createdAt: now,
    });

    const mappedStatus = await syncDeviceRuntimeFromAlarms(client, tenantId, current.device_id, now, null);

    await insertAuditLog(client, {
      id: createId("audit"),
      tenantId,
      actorScope: "tenant",
      actorName: input.operatorName,
      actorRole: input.operatorRole,
      action: "alarm.workflow.update",
      targetType: "alarm",
      targetId: input.alarmId,
      result: "success",
      detail: `${previousStatus} -> ${input.nextStatus}${input.falseAlarm ? "，标记误报" : ""}`,
      createdAt: now,
    });

    await client.query(
      `INSERT INTO duty_logs (id, tenant_id, schedule_id, log_type, content, operator_name, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [createId("duty-log"), tenantId, null, "alarm_action", `报警 ${current.device_name} 状态由 ${previousStatus} 更新为 ${input.nextStatus}`, input.operatorName, now],
    );

    return { current, mappedStatus };
  });

  publishTenantEvent(tenantId, {
    type: "alarm_updated",
    tenantId,
    deviceId: result.current.device_id,
    eventType: "alarm_workflow_updated",
    eventCode: input.nextStatus,
    reportedAt: now,
    occurredAt: now,
  });

  return { deviceStatus: result.mappedStatus.deviceStatusText };
}

export async function updateTenantAlarmProcessStatus(
  tenantId: string,
  alarmId: string,
  processStatus: typeof ALARM_WORKFLOW_PENDING | typeof ALARM_WORKFLOW_PROCESSING | typeof ALARM_PROCESS_RESOLVED,
) {
  assertTenantId(tenantId);
  const updatedAt = formatLocalTimestamp();
  const result = await withTransaction(async (client) => {
    const alarm = await client.query("SELECT * FROM tenant_alarms WHERE tenant_id = $1 AND id = $2 LIMIT 1", [
      tenantId,
      alarmId,
    ]);
    if (alarm.rowCount === 0) {
      throw new Error("ALARM_NOT_FOUND");
    }

    let alarmRow = alarm.rows[0];
    await client.query("UPDATE tenant_alarms SET process_status = $1 WHERE tenant_id = $2 AND id = $3", [
      processStatus,
      tenantId,
      alarmId,
    ]);
    await client.query(
      "UPDATE tenant_alarms SET workflow_status = $1, last_operator_name = $2, completed_at = CASE WHEN $1 = $6 THEN $3 ELSE completed_at END WHERE tenant_id = $4 AND id = $5",
      [
        processStatus === ALARM_PROCESS_RESOLVED ? ALARM_WORKFLOW_COMPLETED : processStatus,
        "tenant_console",
        updatedAt,
        tenantId,
        alarmId,
        ALARM_WORKFLOW_COMPLETED,
      ],
    );

    await insertAlarmLog(client, {
      tenantId,
      alarmId,
      action: "快捷处理",
      fromStatus: normalizeWorkflowStatus(alarmRow.workflow_status ?? alarmRow.process_status),
      toStatus: processStatus === ALARM_PROCESS_RESOLVED ? ALARM_WORKFLOW_COMPLETED : processStatus,
      operatorName: "tenant_console",
      operatorRole: "tenant_console",
      note: "",
      attachments: [],
      createdAt: updatedAt,
    });

    const mappedStatus = await syncDeviceRuntimeFromAlarms(client, tenantId, alarmRow.device_id, updatedAt, null);

    await insertAuditLog(client, {
      id: createId("audit"),
      tenantId,
      actorScope: "tenant",
      actorName: "tenant_console",
      actorRole: "tenant_console",
      action: "alarm.quick_status.update",
      targetType: "alarm",
      targetId: alarmId,
      result: "success",
      detail: `process_status -> ${processStatus}`,
      createdAt: updatedAt,
    });

    await client.query(
      `INSERT INTO duty_logs (id, tenant_id, schedule_id, log_type, content, operator_name, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [createId("duty-log"), tenantId, null, "alarm_action", `报警 ${alarmRow.device_name} 快捷处理为 ${processStatus}`, "tenant_console", updatedAt],
    );

    alarmRow = (await client.query("SELECT * FROM tenant_alarms WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, alarmId])).rows[0];
    return { alarmRow, mappedStatus };
  });

  publishTenantEvent(tenantId, {
    type: "alarm_updated",
    tenantId,
    deviceId: result.alarmRow.device_id,
    eventType: "alarm_status_changed",
    eventCode: processStatus,
    reportedAt: updatedAt,
    occurredAt: updatedAt,
    source: "tenant_console",
  });

  return { alarm: result.alarmRow, deviceStatus: result.mappedStatus.deviceStatusText };
}
