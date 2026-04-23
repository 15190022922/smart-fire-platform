"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { getTenantEventBus } from "@/lib/realtime/event-bus";
import type { AlarmCenterItem, AlarmWorkflowStatus } from "@/types/ops";

const PAGE_SIZE = 8;

const workflowOptions: AlarmWorkflowStatus[] = ["未处理", "已确认", "处理中", "已完成", "已关闭"];

const workflowTone: Record<AlarmWorkflowStatus, string> = {
  未处理: "border-rose-200 bg-rose-50 text-rose-700",
  已确认: "border-sky-200 bg-sky-50 text-sky-700",
  处理中: "border-amber-200 bg-amber-50 text-amber-700",
  已完成: "border-emerald-200 bg-emerald-50 text-emerald-700",
  已关闭: "border-slate-200 bg-slate-100 text-slate-700",
};

export function AlarmCenterBoard({ initialAlarms }: { initialAlarms: AlarmCenterItem[] }) {
  const safeInitialAlarms = Array.isArray(initialAlarms) ? initialAlarms : [];
  const firstAlarm = safeInitialAlarms[0] ?? null;
  const [alarms, setAlarms] = useState(safeInitialAlarms);
  const [selectedAlarmId, setSelectedAlarmId] = useState(safeInitialAlarms[0]?.id ?? "");
  const [statusFilter, setStatusFilter] = useState<AlarmWorkflowStatus | "all">("all");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState(firstAlarm?.detailNote ?? "");
  const [attachments, setAttachments] = useState(firstAlarm?.attachments.join("\n") ?? "");
  const [assignedUserName, setAssignedUserName] = useState(firstAlarm?.assignedUserName ?? "");
  const [falseAlarm, setFalseAlarm] = useState(firstAlarm?.falseAlarm ?? false);
  const [errorMessage, setErrorMessage] = useState("");

  const filteredAlarms = useMemo(() => {
    return alarms.filter((alarm) => {
      if (statusFilter !== "all" && alarm.workflowStatus !== statusFilter) return false;
      if (!keyword.trim()) return true;
      const target = `${alarm.deviceName} ${alarm.alarmType} ${alarm.location}`.toLowerCase();
      return target.includes(keyword.trim().toLowerCase());
    });
  }, [alarms, keyword, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredAlarms.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleAlarms = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredAlarms.slice(start, start + PAGE_SIZE);
  }, [filteredAlarms, safePage]);

  const selectedAlarm = alarms.find((alarm) => alarm.id === selectedAlarmId) ?? visibleAlarms[0] ?? alarms[0] ?? null;

  async function refresh() {
    const refreshed = await fetch("/api/tenant/alarm-center", { cache: "no-store" });
    if (!refreshed.ok) return;
    const data = (await refreshed.json()) as { alarms?: AlarmCenterItem[] };
    setAlarms(Array.isArray(data.alarms) ? data.alarms : []);
  }

  useEffect(() => {
    const bus = getTenantEventBus();
    const unsubscribe = bus.subscribe({
      types: ["alarm_created", "alarm_updated"],
      onEvent: () => {
        void refresh();
      },
    });
    return unsubscribe;
  }, []);

  async function updateAlarm(nextStatus: AlarmWorkflowStatus) {
    if (!selectedAlarm) return;

    setSaving(true);
    setErrorMessage("");

    const response = await fetch("/api/tenant/alarm-center", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        alarmId: selectedAlarm.id,
        nextStatus,
        falseAlarm,
        note,
        attachments: attachments
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        assignedUserName,
      }),
    });

    setSaving(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      setErrorMessage(payload?.message ?? "报警闭环更新失败");
      return;
    }

    await refresh();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="报警中心"
        subtitle="所有报警必须进入闭环流程。这里统一完成确认、处理、完成、关闭、误报标记、备注、附件和时间轴追踪。"
        aside={
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <p>未闭环报警</p>
            <p className="mt-1 text-2xl font-semibold">
              {alarms.filter((item) => item.workflowStatus !== "已关闭" && item.workflowStatus !== "已完成").length}
            </p>
          </div>
        }
      />

      <SectionCard title="报警池" description="按状态和关键字快速定位当前值守中的报警。">
        <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as AlarmWorkflowStatus | "all");
              setPage(1);
            }}
            className="rounded-2xl border border-[color:var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
          >
            <option value="all">全部状态</option>
            {workflowOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <input
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(1);
            }}
            placeholder="按设备名称、位置、报警类型搜索"
            className="rounded-2xl border border-[color:var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm"
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <div className="min-h-0 space-y-3 overflow-y-auto">
            {visibleAlarms.map((alarm) => (
              <button
                key={alarm.id}
                type="button"
                onClick={() => {
                  setSelectedAlarmId(alarm.id);
                  setNote(alarm.detailNote);
                  setAttachments(alarm.attachments.join("\n"));
                  setAssignedUserName(alarm.assignedUserName);
                  setFalseAlarm(alarm.falseAlarm);
                }}
                className={`w-full rounded-2xl border px-4 py-3 text-left ${
                  selectedAlarm?.id === alarm.id
                    ? "border-sky-300 bg-sky-50"
                    : "border-[color:var(--border)] bg-[var(--surface-muted)]"
                }`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-rose-700">{alarm.alarmType}</p>
                    <p className="mt-1 truncate text-sm text-[color:var(--text-primary)]">{alarm.deviceName}</p>
                    <p className="mt-1 truncate text-xs text-[color:var(--text-muted)]">{alarm.location}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] ${workflowTone[alarm.workflowStatus]}`}>
                    {alarm.workflowStatus}
                  </span>
                </div>
                <div className="mt-2 flex flex-col gap-1 text-[11px] text-[color:var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
                  <span>{alarm.time}</span>
                  {alarm.falseAlarm ? <span className="text-amber-700">已标记误报</span> : null}
                </div>
              </button>
            ))}
            <PaginationBar
              page={safePage}
              totalPages={totalPages}
              totalItems={filteredAlarms.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              label="报警池"
            />
          </div>

          {selectedAlarm ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-[color:var(--text-primary)]">{selectedAlarm.alarmType}</h3>
                    <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{selectedAlarm.deviceName}</p>
                    <p className="mt-1 text-sm text-[color:var(--text-muted)]">{selectedAlarm.location}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs ${workflowTone[selectedAlarm.workflowStatus]}`}>
                    {selectedAlarm.workflowStatus}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="text-[color:var(--text-secondary)]">处理状态</span>
                    <select
                      value={selectedAlarm.workflowStatus}
                      onChange={(event) => void updateAlarm(event.target.value as AlarmWorkflowStatus)}
                      disabled={saving}
                      className="w-full rounded-2xl border border-[color:var(--field-border)] bg-[var(--field-bg)] px-3 py-2"
                    >
                      {workflowOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-[color:var(--text-secondary)]">指派处理人</span>
                    <input
                      value={assignedUserName}
                      onChange={(event) => setAssignedUserName(event.target.value)}
                      className="w-full rounded-2xl border border-[color:var(--field-border)] bg-[var(--field-bg)] px-3 py-2"
                    />
                  </label>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
                    <input type="checkbox" checked={falseAlarm} onChange={(event) => setFalseAlarm(event.target.checked)} />
                    <span>标记为误报</span>
                  </label>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void updateAlarm("已关闭")}
                    className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 disabled:opacity-60"
                  >
                    保存并关闭
                  </button>
                </div>

                <label className="mt-3 block space-y-1 text-sm">
                  <span className="text-[color:var(--text-secondary)]">处置备注</span>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={4}
                    className="w-full rounded-2xl border border-[color:var(--field-border)] bg-[var(--field-bg)] px-3 py-2"
                  />
                </label>

                <label className="mt-3 block space-y-1 text-sm">
                  <span className="text-[color:var(--text-secondary)]">附件（每行一个名称或链接）</span>
                  <textarea
                    value={attachments}
                    onChange={(event) => setAttachments(event.target.value)}
                    rows={3}
                    className="w-full rounded-2xl border border-[color:var(--field-border)] bg-[var(--field-bg)] px-3 py-2"
                  />
                </label>

                {errorMessage ? <p className="mt-3 text-sm text-rose-600">{errorMessage}</p> : null}
              </div>

              <SectionCard title="处理时间轴" description="所有关键操作都记录到时间轴，供值守复盘和审计。">
                <div className="space-y-3">
                  {selectedAlarm.timeline.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        <p className="text-sm font-semibold text-[color:var(--text-primary)]">{item.action}</p>
                        <span className="text-xs text-[color:var(--text-muted)]">{item.createdAt}</span>
                      </div>
                      <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                        {item.operatorName} / {item.operatorRole} / {item.fromStatus} → {item.toStatus}
                      </p>
                      {item.note ? <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{item.note}</p> : null}
                      {item.attachments.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.attachments.map((attachment) => (
                            <span key={attachment} className="rounded-full border border-[color:var(--border)] px-2.5 py-1 text-xs">
                              {attachment}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-12 text-center text-sm text-[color:var(--text-muted)]">
              当前没有报警数据。
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
