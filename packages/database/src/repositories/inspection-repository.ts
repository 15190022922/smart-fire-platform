import { queryDb } from "../client";
import { assertTenantId } from "../errors";
import { withTransaction } from "../transaction";
import {
  ISSUE_STATUS_PENDING,
  createId,
  formatLocalDate,
  formatLocalTimestamp,
  mapInspectionRecord,
  mapInspectionTask,
  mapIssue,
  mapMaintenanceRecord,
} from "./_shared";
import { insertAuditLog } from "./audit-repository";

export async function getInspectionCenterData(tenantId: string) {
  assertTenantId(tenantId);
  const [tasks, records, issues, maintenanceRecords] = await Promise.all([
    queryDb("SELECT * FROM inspection_tasks WHERE tenant_id = $1 ORDER BY due_date DESC, created_at DESC LIMIT 200", [tenantId]),
    queryDb("SELECT * FROM inspection_records WHERE tenant_id = $1 ORDER BY inspected_at DESC LIMIT 300", [tenantId]),
    queryDb("SELECT * FROM issues WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 200", [tenantId]),
    queryDb("SELECT * FROM maintenance_records WHERE tenant_id = $1 ORDER BY next_due_date ASC LIMIT 200", [tenantId]),
  ]);

  return {
    generatedAt: formatLocalTimestamp(),
    tasks: tasks.rows.map(mapInspectionTask),
    records: records.rows.map(mapInspectionRecord),
    issues: issues.rows.map(mapIssue),
    maintenanceRecords: maintenanceRecords.rows.map(mapMaintenanceRecord),
  };
}

export async function createInspectionTask(
  tenantId: string,
  input: {
    title: string;
    planType: "daily" | "weekly";
    targetType: "device" | "area";
    targetId: string;
    targetName: string;
    dueDate: string;
    assignedTo: string;
    note: string;
    operatorName: string;
  },
) {
  assertTenantId(tenantId);
  const taskId = createId("inspection-task");
  const createdAt = formatLocalTimestamp();

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO inspection_tasks (id, tenant_id, title, plan_type, target_type, target_id, target_name, due_date, assigned_to, status, note, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11)`,
      [taskId, tenantId, input.title, input.planType, input.targetType, input.targetId, input.targetName, input.dueDate, input.assignedTo, input.note, createdAt],
    );

    await insertAuditLog(client, {
      id: createId("audit"),
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

export async function submitInspectionRecord(
  tenantId: string,
  input: {
    taskId: string;
    result: "completed" | "abnormal";
    note: string;
    inspectedBy: string;
  },
) {
  assertTenantId(tenantId);
  const createdAt = formatLocalTimestamp();
  const recordId = createId("inspection-record");

  await withTransaction(async (client) => {
    const taskRow = await client.query("SELECT * FROM inspection_tasks WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, input.taskId]);
    if (taskRow.rowCount === 0) {
      throw new Error("INSPECTION_TASK_NOT_FOUND");
    }

    const task = taskRow.rows[0];
    await client.query(
      `INSERT INTO inspection_records (id, tenant_id, task_id, result, note, inspected_by, inspected_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [recordId, tenantId, input.taskId, input.result, input.note, input.inspectedBy, createdAt],
    );

    await client.query("UPDATE inspection_tasks SET status = $1 WHERE tenant_id = $2 AND id = $3", [
      input.result === "abnormal" ? "abnormal" : "completed",
      tenantId,
      input.taskId,
    ]);

    if (input.result === "abnormal") {
      const issueId = createId("issue");
      await client.query(
        `INSERT INTO issues (id, tenant_id, source_type, source_id, title, level, status, note, rectification_deadline, rectified_at, reviewed_at, created_at)
         VALUES ($1,$2,'inspection',$3,$4,'medium',$5,$6,$7,NULL,NULL,$8)`,
        [issueId, tenantId, input.taskId, `${task.title} 发现异常`, ISSUE_STATUS_PENDING, input.note, formatLocalDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)), createdAt],
      );
    }

    await insertAuditLog(client, {
      id: createId("audit"),
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

export async function updateIssueStatus(
  tenantId: string,
  input: {
    issueId: string;
    status: string;
    note: string;
    operatorName: string;
  },
) {
  assertTenantId(tenantId);
  const createdAt = formatLocalTimestamp();
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE issues
       SET status = $1,
           note = $2,
           rectified_at = CASE WHEN $1 = '宸叉暣鏀?' THEN COALESCE(rectified_at, $3) ELSE rectified_at END,
           reviewed_at = CASE WHEN $1 = '宸插鏌?' THEN COALESCE(reviewed_at, $3) ELSE reviewed_at END
       WHERE tenant_id = $4 AND id = $5`,
      [input.status, input.note, createdAt, tenantId, input.issueId],
    );

    await insertAuditLog(client, {
      id: createId("audit"),
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
