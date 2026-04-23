"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { PaginationBar } from "@/components/ui/pagination-bar";
import type { InspectionCenterPayload, InspectionTaskRecord, IssueRecord } from "@/types/inspection";

const inputClassName =
  "w-full rounded-2xl border border-[color:var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100";

const TASK_PAGE_SIZE = 6;
const ISSUE_PAGE_SIZE = 6;
const RECORD_PAGE_SIZE = 8;
const MAINTENANCE_PAGE_SIZE = 8;

export function InspectionBoard({ initialData }: { initialData: InspectionCenterPayload | null }) {
  const [data, setData] = useState<InspectionCenterPayload | null>(initialData);
  const [message, setMessage] = useState("");
  const [taskPage, setTaskPage] = useState(1);
  const [issuePage, setIssuePage] = useState(1);
  const [recordPage, setRecordPage] = useState(1);
  const [maintenancePage, setMaintenancePage] = useState(1);
  const [taskForm, setTaskForm] = useState({
    title: "",
    planType: "daily" as "daily" | "weekly",
    targetType: "device" as "device" | "area",
    targetId: "",
    targetName: "",
    dueDate: initialData?.generatedAt.slice(0, 10) ?? "",
    assignedTo: "",
    note: "",
  });

  const taskTotalPages = Math.max(1, Math.ceil((data?.tasks.length ?? 0) / TASK_PAGE_SIZE));
  const issueTotalPages = Math.max(1, Math.ceil((data?.issues.length ?? 0) / ISSUE_PAGE_SIZE));
  const recordTotalPages = Math.max(1, Math.ceil((data?.records.length ?? 0) / RECORD_PAGE_SIZE));
  const maintenanceTotalPages = Math.max(
    1,
    Math.ceil((data?.maintenanceRecords.length ?? 0) / MAINTENANCE_PAGE_SIZE),
  );
  const safeTaskPage = Math.min(taskPage, taskTotalPages);
  const safeIssuePage = Math.min(issuePage, issueTotalPages);
  const safeRecordPage = Math.min(recordPage, recordTotalPages);
  const safeMaintenancePage = Math.min(maintenancePage, maintenanceTotalPages);

  const visibleTasks = useMemo(() => {
    const tasks = data?.tasks ?? [];
    const start = (safeTaskPage - 1) * TASK_PAGE_SIZE;
    return tasks.slice(start, start + TASK_PAGE_SIZE);
  }, [data?.tasks, safeTaskPage]);

  const visibleIssues = useMemo(() => {
    const issues = data?.issues ?? [];
    const start = (safeIssuePage - 1) * ISSUE_PAGE_SIZE;
    return issues.slice(start, start + ISSUE_PAGE_SIZE);
  }, [data?.issues, safeIssuePage]);

  const visibleRecords = useMemo(() => {
    const records = data?.records ?? [];
    const start = (safeRecordPage - 1) * RECORD_PAGE_SIZE;
    return records.slice(start, start + RECORD_PAGE_SIZE);
  }, [data?.records, safeRecordPage]);

  const visibleMaintenanceRecords = useMemo(() => {
    const records = data?.maintenanceRecords ?? [];
    const start = (safeMaintenancePage - 1) * MAINTENANCE_PAGE_SIZE;
    return records.slice(start, start + MAINTENANCE_PAGE_SIZE);
  }, [data?.maintenanceRecords, safeMaintenancePage]);

  if (!data) {
    return null;
  }

  async function createTask() {
    const response = await fetch("/api/tenant/inspection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create-task", ...taskForm }),
    });
    const payload = (await response.json()) as InspectionCenterPayload | { message?: string };
    if (!response.ok) {
      setMessage("message" in payload ? payload.message ?? "巡检任务创建失败" : "巡检任务创建失败");
      return;
    }
    setData(payload as InspectionCenterPayload);
    setMessage("巡检任务已创建");
    setTaskForm((current) => ({
      ...current,
      title: "",
      targetId: "",
      targetName: "",
      assignedTo: "",
      note: "",
    }));
  }

  async function submitInspection(taskId: string, result: "completed" | "abnormal") {
    const response = await fetch("/api/tenant/inspection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "submit-record",
        taskId,
        result,
        note: result === "abnormal" ? "发现异常，已转入隐患整改" : "巡检已完成",
      }),
    });
    const payload = (await response.json()) as InspectionCenterPayload | { message?: string };
    if (!response.ok) {
      setMessage("message" in payload ? payload.message ?? "巡检执行失败" : "巡检执行失败");
      return;
    }
    setData(payload as InspectionCenterPayload);
    setMessage(result === "abnormal" ? "异常已转为隐患任务" : "巡检记录已保存");
  }

  async function updateIssue(issueId: string, status: IssueRecord["status"]) {
    const response = await fetch("/api/tenant/inspection", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issueId, status, note: `状态更新为 ${status}` }),
    });
    const payload = (await response.json()) as InspectionCenterPayload | { message?: string };
    if (!response.ok) {
      setMessage("message" in payload ? payload.message ?? "隐患状态更新失败" : "隐患状态更新失败");
      return;
    }
    setData(payload as InspectionCenterPayload);
    setMessage("隐患状态已更新");
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="巡检与维保"
        subtitle="巡检计划、执行记录、隐患整改和维保历史统一归档。异常巡检结果会自动转入隐患整改流程。"
        aside={
          <div className="grid grid-cols-3 gap-3">
            <MetricCard label="巡检任务" value={String(data.tasks.length)} />
            <MetricCard
              label="整改中隐患"
              value={String(data.issues.filter((item) => item.status !== "已复查").length)}
            />
            <MetricCard label="维保记录" value={String(data.maintenanceRecords.length)} />
          </div>
        }
      />

      {message ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">{message}</div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="巡检计划" description="支持按天 / 按周创建任务，指定到设备或区域。">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={taskForm.title}
              onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="任务名称"
              className={inputClassName}
            />
            <input
              value={taskForm.dueDate}
              type="date"
              onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))}
              className={inputClassName}
            />
            <select
              value={taskForm.planType}
              onChange={(event) =>
                setTaskForm((current) => ({ ...current, planType: event.target.value as "daily" | "weekly" }))
              }
              className={inputClassName}
            >
              <option value="daily">按天</option>
              <option value="weekly">按周</option>
            </select>
            <select
              value={taskForm.targetType}
              onChange={(event) =>
                setTaskForm((current) => ({ ...current, targetType: event.target.value as "device" | "area" }))
              }
              className={inputClassName}
            >
              <option value="device">设备</option>
              <option value="area">区域</option>
            </select>
            <input
              value={taskForm.targetId}
              onChange={(event) => setTaskForm((current) => ({ ...current, targetId: event.target.value }))}
              placeholder="目标 ID"
              className={inputClassName}
            />
            <input
              value={taskForm.targetName}
              onChange={(event) => setTaskForm((current) => ({ ...current, targetName: event.target.value }))}
              placeholder="目标名称"
              className={inputClassName}
            />
            <input
              value={taskForm.assignedTo}
              onChange={(event) => setTaskForm((current) => ({ ...current, assignedTo: event.target.value }))}
              placeholder="执行人"
              className={inputClassName}
            />
            <input
              value={taskForm.note}
              onChange={(event) => setTaskForm((current) => ({ ...current, note: event.target.value }))}
              placeholder="备注"
              className={inputClassName}
            />
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => void createTask()}
              className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700"
            >
              创建巡检任务
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {visibleTasks.map((task) => (
              <TaskCard key={task.id} task={task} onSubmit={submitInspection} />
            ))}
          </div>
          <PaginationBar
            page={safeTaskPage}
            totalPages={taskTotalPages}
            totalItems={data.tasks.length}
            pageSize={TASK_PAGE_SIZE}
            onPageChange={setTaskPage}
            label="巡检任务"
          />
        </SectionCard>

        <SectionCard title="隐患整改" description="异常巡检会生成隐患。隐患必须经历整改、复查、闭环。">
          <div className="space-y-3">
            {visibleIssues.map((issue) => (
              <div
                key={issue.id}
                className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--text-primary)]">{issue.title}</p>
                    <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                      {issue.createdAt} / 截止 {issue.rectificationDeadline ?? "未设置"}
                    </p>
                  </div>
                  <span className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs text-[color:var(--text-secondary)]">
                    {issue.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{issue.note || "暂无说明"}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["未整改", "整改中", "已整改", "已复查"] as IssueRecord["status"][]).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => void updateIssue(issue.id, status)}
                      className="rounded-full border px-3 py-1 text-xs text-[color:var(--text-secondary)]"
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <PaginationBar
            page={safeIssuePage}
            totalPages={issueTotalPages}
            totalItems={data.issues.length}
            pageSize={ISSUE_PAGE_SIZE}
            onPageChange={setIssuePage}
            label="隐患"
          />
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="巡检执行记录" description="保留每次执行结果，异常记录会自动触发隐患。">
          <div className="space-y-3">
            {visibleRecords.map((record) => (
              <div
                key={record.id}
                className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                    {record.result === "abnormal" ? "发现异常" : "巡检完成"}
                  </p>
                  <span className="text-xs text-[color:var(--text-muted)]">{record.inspectedAt}</span>
                </div>
                <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{record.note}</p>
                <p className="mt-1 text-xs text-[color:var(--text-muted)]">执行人：{record.inspectedBy}</p>
              </div>
            ))}
          </div>
          <PaginationBar
            page={safeRecordPage}
            totalPages={recordTotalPages}
            totalItems={data.records.length}
            pageSize={RECORD_PAGE_SIZE}
            onPageChange={setRecordPage}
            label="巡检记录"
          />
        </SectionCard>

        <SectionCard title="维保记录" description="用于追踪设备维保历史和到期提醒。">
          <div className="space-y-3">
            {visibleMaintenanceRecords.map((record) => (
              <div
                key={record.id}
                className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[color:var(--text-primary)]">{record.deviceName}</p>
                  <span className="text-xs text-[color:var(--text-muted)]">下次到期 {record.nextDueDate}</span>
                </div>
                <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                  {record.vendorName} / {record.maintenanceDate}
                </p>
                <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{record.result}</p>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">{record.note}</p>
              </div>
            ))}
          </div>
          <PaginationBar
            page={safeMaintenancePage}
            totalPages={maintenanceTotalPages}
            totalItems={data.maintenanceRecords.length}
            pageSize={MAINTENANCE_PAGE_SIZE}
            onPageChange={setMaintenancePage}
            label="维保记录"
          />
        </SectionCard>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm">
      <p className="text-[color:var(--text-secondary)]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">{value}</p>
    </div>
  );
}

function TaskCard({
  task,
  onSubmit,
}: {
  task: InspectionTaskRecord;
  onSubmit: (taskId: string, result: "completed" | "abnormal") => void;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[color:var(--text-primary)]">{task.title}</p>
          <p className="mt-1 text-xs text-[color:var(--text-muted)]">
            {task.targetName} / {task.planType === "daily" ? "按天" : "按周"} / 到期 {task.dueDate}
          </p>
        </div>
        <span className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs text-[color:var(--text-secondary)]">
          {task.status}
        </span>
      </div>
      <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{task.note || "无备注"}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void onSubmit(task.id, "completed")}
          className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700"
        >
          标记完成
        </button>
        <button
          type="button"
          onClick={() => void onSubmit(task.id, "abnormal")}
          className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-700"
        >
          标记异常
        </button>
      </div>
    </div>
  );
}
