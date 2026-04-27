"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { PaginationBar } from "@/components/ui/pagination-bar";
import type { DutyCenterPayload, DutyLogRecord, DutyScheduleRecord } from "@/types/duty";

const inputClassName = "sf-input h-10 px-3 text-sm";

const SCHEDULE_PAGE_SIZE = 6;
const LOG_PAGE_SIZE = 8;

export function DutyCenterBoard({ initialData }: { initialData: DutyCenterPayload | null }) {
  const [data, setData] = useState<DutyCenterPayload | null>(initialData);
  const [message, setMessage] = useState("");
  const [logDateFilter, setLogDateFilter] = useState("");
  const [schedulePage, setSchedulePage] = useState(1);
  const [logPage, setLogPage] = useState(1);
  const [scheduleForm, setScheduleForm] = useState({
    dutyDate: initialData?.generatedAt.slice(0, 10) ?? "",
    shiftId: initialData?.shifts[0]?.id ?? "",
    assigneeName: "",
    assigneePhone: "",
  });
  const [handoverForm, setHandoverForm] = useState({
    scheduleId: initialData?.currentSchedule?.id ?? "",
    nextScheduleId: "",
    note: "",
  });

  const filteredLogs = useMemo(() => {
    const logs = data?.dutyLogs ?? [];
    if (!logDateFilter) return logs;
    return logs.filter((item) => item.createdAt.startsWith(logDateFilter));
  }, [data?.dutyLogs, logDateFilter]);

  const scheduleTotalPages = Math.max(1, Math.ceil((data?.schedules.length ?? 0) / SCHEDULE_PAGE_SIZE));
  const logTotalPages = Math.max(1, Math.ceil(filteredLogs.length / LOG_PAGE_SIZE));
  const safeSchedulePage = Math.min(schedulePage, scheduleTotalPages);
  const safeLogPage = Math.min(logPage, logTotalPages);

  const visibleSchedules = useMemo(() => {
    const schedules = data?.schedules ?? [];
    const start = (safeSchedulePage - 1) * SCHEDULE_PAGE_SIZE;
    return schedules.slice(start, start + SCHEDULE_PAGE_SIZE);
  }, [data?.schedules, safeSchedulePage]);

  const visibleLogs = useMemo(() => {
    const start = (safeLogPage - 1) * LOG_PAGE_SIZE;
    return filteredLogs.slice(start, start + LOG_PAGE_SIZE);
  }, [filteredLogs, safeLogPage]);

  async function refresh() {
    const response = await fetch("/api/tenant/duty-center", { cache: "no-store" });
    if (response.ok) {
      setData((await response.json()) as DutyCenterPayload);
    }
  }

  async function submitSchedule() {
    const response = await fetch("/api/tenant/duty-center", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scheduleForm),
    });
    const payload = (await response.json()) as DutyCenterPayload | { message?: string };
    if (!response.ok) {
      setMessage("message" in payload ? payload.message ?? "新增排班失败" : "新增排班失败");
      return;
    }
    setData(payload as DutyCenterPayload);
    setMessage("排班已保存");
    setScheduleForm((current) => ({ ...current, assigneeName: "", assigneePhone: "" }));
  }

  async function submitHandover() {
    const response = await fetch("/api/tenant/duty-center", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(handoverForm),
    });
    const payload = (await response.json()) as DutyCenterPayload | { message?: string };
    if (!response.ok) {
      setMessage("message" in payload ? payload.message ?? "交接班失败" : "交接班失败");
      return;
    }
    setData(payload as DutyCenterPayload);
    setMessage("交接班已记录");
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-2.5">
      <PageHeader
        title="值班中心"
        subtitle="值班排班、交接班和日志统一归口。未闭环报警必须在交接说明中明确带出。"
        aside={
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="sf-metric-block px-3.5 py-2.5 text-sm">
              <p className="text-[color:var(--text-secondary)]">当前值班</p>
              <p className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">
                {data.currentSchedule?.assigneeName ?? "未排班"}
              </p>
            </div>
            <div className="sf-metric-block px-3.5 py-2.5 text-sm">
              <p>未闭环报警</p>
              <p className="mt-1 text-lg font-semibold">{data.openAlarmCount}</p>
            </div>
          </div>
        }
      />

      {message ? (
        <div className="rounded-[14px] border border-[color:rgba(72,106,141,0.18)] bg-[color:var(--accent-soft)] px-4 py-3 text-sm text-[color:var(--accent-strong)]">{message}</div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="当前值班状态" description="按系统时间匹配班次，显示当前值班人、班次时间和起止时间。">
          <div className="grid gap-3 md:grid-cols-2">
            <StatusCard label="当前班次" value={data.currentSchedule?.shiftName ?? "未匹配"} />
            <StatusCard
              label="当前值班时间"
              value={
                data.currentSchedule
                  ? `${data.currentSchedule.shiftStartTime} - ${data.currentSchedule.shiftEndTime}`
                  : "未排班"
              }
            />
            <StatusCard label="开始时间" value={data.currentSchedule?.startedAt ?? "未开始"} />
            <StatusCard label="结束时间" value={data.currentSchedule?.endedAt ?? "进行中"} />
          </div>
        </SectionCard>

        <SectionCard title="交接班" description="手动交接班会自动记录时间。存在未闭环报警时，必须填写交接说明。">
          <div className="space-y-3">
            <select
              value={handoverForm.scheduleId}
              onChange={(event) => setHandoverForm((current) => ({ ...current, scheduleId: event.target.value }))}
              className={inputClassName}
            >
              <option value="">选择当前班次</option>
              {data.schedules.map((schedule) => (
                <option key={schedule.id} value={schedule.id}>
                  {schedule.dutyDate} / {schedule.shiftName} / {schedule.assigneeName}
                </option>
              ))}
            </select>
            <select
              value={handoverForm.nextScheduleId}
              onChange={(event) => setHandoverForm((current) => ({ ...current, nextScheduleId: event.target.value }))}
              className={inputClassName}
            >
              <option value="">选择接班班次（可选）</option>
              {data.schedules
                .filter((schedule) => schedule.id !== handoverForm.scheduleId)
                .map((schedule) => (
                  <option key={schedule.id} value={schedule.id}>
                    {schedule.dutyDate} / {schedule.shiftName} / {schedule.assigneeName}
                  </option>
                ))}
            </select>
            <textarea
              value={handoverForm.note}
              onChange={(event) => setHandoverForm((current) => ({ ...current, note: event.target.value }))}
              rows={4}
              placeholder="填写未处理报警、待跟进事项、设备异常等交接说明"
              className={inputClassName}
            />
            <button
              type="button"
              onClick={() => void submitHandover()}
              className="sf-button sf-button-warning h-10 px-4 text-sm"
            >
              手动交接班
            </button>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="按天排班" description="支持按天安排班次和值守人员。">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              type="date"
              value={scheduleForm.dutyDate}
              onChange={(event) => setScheduleForm((current) => ({ ...current, dutyDate: event.target.value }))}
              className={inputClassName}
            />
            <select
              value={scheduleForm.shiftId}
              onChange={(event) => setScheduleForm((current) => ({ ...current, shiftId: event.target.value }))}
              className={inputClassName}
            >
              {data.shifts.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.name} / {shift.startTime}-{shift.endTime}
                </option>
              ))}
            </select>
            <input
              value={scheduleForm.assigneeName}
              onChange={(event) => setScheduleForm((current) => ({ ...current, assigneeName: event.target.value }))}
              placeholder="值班人员姓名"
              className={inputClassName}
            />
            <input
              value={scheduleForm.assigneePhone}
              onChange={(event) => setScheduleForm((current) => ({ ...current, assigneePhone: event.target.value }))}
              placeholder="值班人员手机号"
              className={inputClassName}
            />
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => void submitSchedule()}
              className="sf-button sf-button-primary h-10 px-4 text-sm"
            >
              保存排班
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {visibleSchedules.map((schedule) => (
              <ScheduleCard key={schedule.id} schedule={schedule} />
            ))}
          </div>
          <PaginationBar
            page={safeSchedulePage}
            totalPages={scheduleTotalPages}
            totalItems={data.schedules.length}
            pageSize={SCHEDULE_PAGE_SIZE}
            onPageChange={setSchedulePage}
            label="排班"
          />
        </SectionCard>

        <SectionCard
          title="值班日志"
          description="记录登录、报警处理、交接班和异常操作，可按日期过滤。"
          extra={
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={logDateFilter}
                onChange={(event) => {
                  setLogDateFilter(event.target.value);
                  setLogPage(1);
                }}
                className={inputClassName}
              />
              <button
                type="button"
                onClick={() => void refresh()}
                className="sf-button sf-button-secondary h-10 px-3 text-sm"
              >
                刷新
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            {visibleLogs.map((item) => (
              <div
                key={item.id}
                className="sf-list-row px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                    {dutyLogTypeLabel(item.logType)}
                  </p>
                  <span className="text-xs text-[color:var(--text-muted)]">{item.createdAt}</span>
                </div>
                <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{item.content}</p>
                <p className="mt-1 text-xs text-[color:var(--text-muted)]">操作人：{item.operatorName}</p>
              </div>
            ))}
          </div>
          <PaginationBar
            page={safeLogPage}
            totalPages={logTotalPages}
            totalItems={filteredLogs.length}
            pageSize={LOG_PAGE_SIZE}
            onPageChange={setLogPage}
            label="值班日志"
          />
        </SectionCard>
      </div>
    </div>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="sf-metric-block px-4 py-3 text-sm">
      <p className="text-[color:var(--text-secondary)]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">{value}</p>
    </div>
  );
}

function ScheduleCard({ schedule }: { schedule: DutyScheduleRecord }) {
  return (
    <div className="sf-list-row px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[color:var(--text-primary)]">
            {schedule.dutyDate} / {schedule.shiftName}
          </p>
          <p className="mt-1 text-xs text-[color:var(--text-muted)]">
            {schedule.assigneeName} / {schedule.assigneePhone}
          </p>
        </div>
        <span className="rounded-full border border-[color:var(--border-soft)] bg-white/80 px-3 py-1 text-xs text-[color:var(--text-secondary)]">
          {schedule.status}
        </span>
      </div>
      {schedule.handoverNote ? (
        <p className="mt-2 text-sm text-[color:var(--text-secondary)]">交接说明：{schedule.handoverNote}</p>
      ) : null}
    </div>
  );
}

function dutyLogTypeLabel(type: DutyLogRecord["logType"]) {
  if (type === "login") return "登录";
  if (type === "alarm_action") return "报警处理";
  if (type === "handover") return "交接班";
  if (type === "exception") return "异常操作";
  return "班次操作";
}
