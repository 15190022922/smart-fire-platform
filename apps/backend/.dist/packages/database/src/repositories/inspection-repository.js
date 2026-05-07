"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInspectionCenterData = getInspectionCenterData;
exports.createInspectionTask = createInspectionTask;
exports.submitInspectionRecord = submitInspectionRecord;
exports.updateIssueStatus = updateIssueStatus;
const client_1 = require("../client");
const errors_1 = require("../errors");
const transaction_1 = require("../transaction");
const _shared_1 = require("./_shared");
const audit_repository_1 = require("./audit-repository");
async function getInspectionCenterData(tenantId) {
    (0, errors_1.assertTenantId)(tenantId);
    const [tasks, records, issues, maintenanceRecords] = await Promise.all([
        (0, client_1.queryDb)("SELECT * FROM inspection_tasks WHERE tenant_id = $1 ORDER BY due_date DESC, created_at DESC LIMIT 200", [tenantId]),
        (0, client_1.queryDb)("SELECT * FROM inspection_records WHERE tenant_id = $1 ORDER BY inspected_at DESC LIMIT 300", [tenantId]),
        (0, client_1.queryDb)("SELECT * FROM issues WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 200", [tenantId]),
        (0, client_1.queryDb)("SELECT * FROM maintenance_records WHERE tenant_id = $1 ORDER BY next_due_date ASC LIMIT 200", [tenantId]),
    ]);
    return {
        generatedAt: (0, _shared_1.formatLocalTimestamp)(),
        tasks: tasks.rows.map(_shared_1.mapInspectionTask),
        records: records.rows.map(_shared_1.mapInspectionRecord),
        issues: issues.rows.map(_shared_1.mapIssue),
        maintenanceRecords: maintenanceRecords.rows.map(_shared_1.mapMaintenanceRecord),
    };
}
async function createInspectionTask(tenantId, input) {
    (0, errors_1.assertTenantId)(tenantId);
    const taskId = (0, _shared_1.createId)("inspection-task");
    const createdAt = (0, _shared_1.formatLocalTimestamp)();
    await (0, transaction_1.withTransaction)(async (client) => {
        await client.query(`INSERT INTO inspection_tasks (id, tenant_id, title, plan_type, target_type, target_id, target_name, due_date, assigned_to, status, note, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11)`, [taskId, tenantId, input.title, input.planType, input.targetType, input.targetId, input.targetName, input.dueDate, input.assignedTo, input.note, createdAt]);
        await (0, audit_repository_1.insertAuditLog)(client, {
            id: (0, _shared_1.createId)("audit"),
            tenantId,
            actorScope: "tenant",
            actorName: input.operatorName,
            actorRole: "tenant_inspection_manager",
            action: "inspection.task.create",
            targetType: "inspection_task",
            targetId: taskId,
            result: "success",
            detail: `${input.title} / ${input.targetName}`,
            createdAt,
        });
    });
}
async function submitInspectionRecord(tenantId, input) {
    (0, errors_1.assertTenantId)(tenantId);
    const createdAt = (0, _shared_1.formatLocalTimestamp)();
    const recordId = (0, _shared_1.createId)("inspection-record");
    await (0, transaction_1.withTransaction)(async (client) => {
        const taskRow = await client.query("SELECT * FROM inspection_tasks WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, input.taskId]);
        if (taskRow.rowCount === 0) {
            throw new Error("INSPECTION_TASK_NOT_FOUND");
        }
        const task = taskRow.rows[0];
        await client.query(`INSERT INTO inspection_records (id, tenant_id, task_id, result, note, inspected_by, inspected_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`, [recordId, tenantId, input.taskId, input.result, input.note, input.inspectedBy, createdAt]);
        await client.query("UPDATE inspection_tasks SET status = $1 WHERE tenant_id = $2 AND id = $3", [
            input.result === "abnormal" ? "abnormal" : "completed",
            tenantId,
            input.taskId,
        ]);
        if (input.result === "abnormal") {
            const issueId = (0, _shared_1.createId)("issue");
            await client.query(`INSERT INTO issues (id, tenant_id, source_type, source_id, title, level, status, note, rectification_deadline, rectified_at, reviewed_at, created_at)
         VALUES ($1,$2,'inspection',$3,$4,'medium',$5,$6,$7,NULL,NULL,$8)`, [issueId, tenantId, input.taskId, `${task.title} 发现异常`, _shared_1.ISSUE_STATUS_PENDING, input.note, (0, _shared_1.formatLocalDate)(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)), createdAt]);
        }
        await (0, audit_repository_1.insertAuditLog)(client, {
            id: (0, _shared_1.createId)("audit"),
            tenantId,
            actorScope: "tenant",
            actorName: input.inspectedBy,
            actorRole: "tenant_inspector",
            action: "inspection.record.submit",
            targetType: "inspection_task",
            targetId: input.taskId,
            result: "success",
            detail: `result=${input.result}`,
            createdAt,
        });
    });
}
async function updateIssueStatus(tenantId, input) {
    (0, errors_1.assertTenantId)(tenantId);
    const createdAt = (0, _shared_1.formatLocalTimestamp)();
    await (0, transaction_1.withTransaction)(async (client) => {
        await client.query(`UPDATE issues
       SET status = $1,
           note = $2,
           rectified_at = CASE WHEN $1 = $6 THEN COALESCE(rectified_at, $3) ELSE rectified_at END,
           reviewed_at = CASE WHEN $1 = $7 THEN COALESCE(reviewed_at, $3) ELSE reviewed_at END
       WHERE tenant_id = $4 AND id = $5`, [input.status, input.note, createdAt, tenantId, input.issueId, _shared_1.ISSUE_STATUS_RESOLVED, _shared_1.ISSUE_STATUS_REVIEWED]);
        await (0, audit_repository_1.insertAuditLog)(client, {
            id: (0, _shared_1.createId)("audit"),
            tenantId,
            actorScope: "tenant",
            actorName: input.operatorName,
            actorRole: "tenant_issue_manager",
            action: "issue.status.update",
            targetType: "issue",
            targetId: input.issueId,
            result: "success",
            detail: `status=${input.status}`,
            createdAt,
        });
    });
}
