"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDutyLogEntry = createDutyLogEntry;
exports.getDutyCenterData = getDutyCenterData;
exports.createDutySchedule = createDutySchedule;
exports.handoverDutySchedule = handoverDutySchedule;
const client_1 = require("../client");
const errors_1 = require("../errors");
const transaction_1 = require("../transaction");
const _shared_1 = require("./_shared");
const audit_repository_1 = require("./audit-repository");
async function insertDutyLog(executor, input) {
    await executor.query(`INSERT INTO duty_logs (id, tenant_id, schedule_id, log_type, content, operator_name, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`, [(0, _shared_1.createId)("duty-log"), input.tenantId, input.scheduleId ?? null, input.logType, input.content, input.operatorName, input.createdAt]);
}
async function createDutyLogEntry(input) {
    (0, errors_1.assertTenantId)(input.tenantId);
    return (0, transaction_1.withTransaction)(async (client) => {
        await insertDutyLog(client, {
            ...input,
            createdAt: input.createdAt ?? (0, _shared_1.formatLocalTimestamp)(),
        });
    });
}
function resolveCurrentDutySchedule(schedules) {
    const now = new Date();
    const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const minutes = now.getHours() * 60 + now.getMinutes();
    for (const schedule of schedules) {
        if (schedule.dutyDate !== currentDate)
            continue;
        const [startHour, startMinute] = schedule.shiftStartTime.split(":").map(Number);
        const [endHour, endMinute] = schedule.shiftEndTime.split(":").map(Number);
        const start = (startHour || 0) * 60 + (startMinute || 0);
        const end = (endHour || 0) * 60 + (endMinute || 0);
        const inRange = end > start ? minutes >= start && minutes < end : minutes >= start || minutes < end;
        if (inRange)
            return schedule;
    }
    return schedules.find((item) => item.dutyDate === currentDate);
}
async function getDutyCenterData(tenantId) {
    (0, errors_1.assertTenantId)(tenantId);
    const [shiftRows, scheduleRows, logRows, openAlarmRow] = await Promise.all([
        (0, client_1.queryDb)("SELECT * FROM duty_shifts WHERE tenant_id = $1 ORDER BY start_time ASC", [tenantId]),
        (0, client_1.queryDb)("SELECT * FROM duty_schedules WHERE tenant_id = $1 ORDER BY duty_date DESC, shift_id ASC LIMIT 30", [tenantId]),
        (0, client_1.queryDb)("SELECT * FROM duty_logs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 200", [tenantId]),
        (0, client_1.queryDb)("SELECT COUNT(*)::int AS count FROM tenant_alarms WHERE tenant_id = $1 AND COALESCE(process_status, workflow_status) <> $2", [tenantId, _shared_1.ALARM_PROCESS_RESOLVED]),
    ]);
    const shifts = shiftRows.rows.map(_shared_1.mapDutyShift);
    const schedules = scheduleRows.rows.map((row) => (0, _shared_1.mapDutySchedule)(row, shifts));
    return {
        generatedAt: (0, _shared_1.formatLocalTimestamp)(),
        shifts,
        schedules,
        currentSchedule: resolveCurrentDutySchedule(schedules),
        openAlarmCount: Number(openAlarmRow.rows[0]?.count ?? 0),
        dutyLogs: logRows.rows.map(_shared_1.mapDutyLog),
    };
}
async function createDutySchedule(tenantId, input) {
    (0, errors_1.assertTenantId)(tenantId);
    const id = (0, _shared_1.createId)("duty-schedule");
    const createdAt = (0, _shared_1.formatLocalTimestamp)();
    await (0, transaction_1.withTransaction)(async (client) => {
        await client.query(`INSERT INTO duty_schedules (id, tenant_id, duty_date, shift_id, assignee_name, assignee_phone, assigned_by, status, started_at, ended_at, handover_note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL,NULL,'')`, [id, tenantId, input.dutyDate, input.shiftId, input.assigneeName, input.assigneePhone, input.assignedBy, _shared_1.DUTY_STATUS_SCHEDULED]);
        await insertDutyLog(client, {
            tenantId,
            scheduleId: id,
            logType: "shift_action",
            content: `新增值班排班：${input.dutyDate} / ${input.assigneeName}`,
            operatorName: input.assignedBy,
            createdAt,
        });
        await (0, audit_repository_1.insertAuditLog)(client, {
            id: (0, _shared_1.createId)("audit"),
            tenantId,
            actorScope: "tenant",
            actorName: input.assignedBy,
            actorRole: "tenant_dispatcher",
            action: "duty.schedule.create",
            targetType: "duty_schedule",
            targetId: id,
            result: "success",
            detail: `${input.dutyDate} / ${input.shiftId} / ${input.assigneeName}`,
            createdAt,
        });
    });
}
async function handoverDutySchedule(tenantId, input) {
    (0, errors_1.assertTenantId)(tenantId);
    const createdAt = (0, _shared_1.formatLocalTimestamp)();
    await (0, transaction_1.withTransaction)(async (client) => {
        const openAlarmRow = await client.query("SELECT COUNT(*)::int AS count FROM tenant_alarms WHERE tenant_id = $1 AND COALESCE(process_status, workflow_status) <> $2", [tenantId, _shared_1.ALARM_PROCESS_RESOLVED]);
        const openAlarmCount = Number(openAlarmRow.rows[0]?.count ?? 0);
        if (openAlarmCount > 0 && !input.note.trim()) {
            throw new Error("HANDOVER_NOTE_REQUIRED");
        }
        await client.query(`UPDATE duty_schedules
       SET status = $1, ended_at = $2, handover_note = $3
       WHERE tenant_id = $4 AND id = $5`, [_shared_1.DUTY_STATUS_HANDOVER, createdAt, input.note, tenantId, input.scheduleId]);
        if (input.nextScheduleId) {
            await client.query(`UPDATE duty_schedules
         SET status = $1, started_at = COALESCE(started_at, $2)
         WHERE tenant_id = $3 AND id = $4`, [_shared_1.DUTY_STATUS_ACTIVE, createdAt, tenantId, input.nextScheduleId]);
        }
        await insertDutyLog(client, {
            tenantId,
            scheduleId: input.scheduleId,
            logType: "handover",
            content: `完成交接班，遗留未闭环报警 ${openAlarmCount} 条。${input.note ? `备注：${input.note}` : ""}`,
            operatorName: input.operatorName,
            createdAt,
        });
        await (0, audit_repository_1.insertAuditLog)(client, {
            id: (0, _shared_1.createId)("audit"),
            tenantId,
            actorScope: "tenant",
            actorName: input.operatorName,
            actorRole: "tenant_duty_operator",
            action: "duty.handover",
            targetType: "duty_schedule",
            targetId: input.scheduleId,
            result: "success",
            detail: `未闭环报警 ${openAlarmCount} 条`,
            createdAt,
        });
    });
}
