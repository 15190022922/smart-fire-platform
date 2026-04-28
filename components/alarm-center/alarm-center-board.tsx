"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { getTenantEventBus } from "@/lib/realtime/event-bus";
import type { AlarmCenterItem, AlarmWorkflowStatus } from "@/types/ops";

const PAGE_SIZE = 8;

const workflowOptions: AlarmWorkflowStatus[] = ["未处理", "已确认", "处理中", "已完成", "已关闭"];
const inputClassName = "sf-input h-10 px-3 text-sm";

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
  const isRefreshingRef = useRef(false);
  const pendingRefreshRef = useRef(false);

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

  const refresh = useCallback(async () => {
    if (isRefreshingRef.current) {
      pendingRefreshRef.current = true;
      return;
    }
    isRefreshingRef.current = true;

    try {
      do {
        pendingRefreshRef.current = false;
        const refreshed = await fetch("/api/tenant/alarm-center", { cache: "no-store" });
        if (!refreshed.ok) return;
        const data = (await refreshed.json()) as { alarms?: AlarmCenterItem[] };
        setAlarms(Array.isArray(data.alarms) ? data.alarms : []);
      } while (pendingRefreshRef.current);
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const bus = getTenantEventBus();
    const pollTimer = window.setInterval(() => {
      void refresh();
    }, 30000);
    const handleFocus = () => void refresh();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };
    const unsubscribe = bus.subscribe({
      types: ["alarm_created", "alarm_updated", "device_status_changed", "system_alert"],
      onEvent: () => {
        void refresh();
      },
    });
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      unsubscribe();
      window.clearInterval(pollTimer);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refresh]);

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
    <div className="space-y-2.5">
      <PageHeader
        title="报警中心"
        subtitle="所有报警必须进入闭环流程。这里统一完成确认、处理、完成、关闭、误报标记、备注、附件和时间轴追踪。"
        aside={
          <div className="sf-metric-block min-w-[154px] px-3.5 py-2.5">
            <p className="sf-label text-[color:var(--danger-strong)]">Open Alarms</p>
            <p className="mt-1.5 text-[1.45rem] font-semibold leading-none tracking-[-0.03em] text-[color:var(--danger-strong)]">
              {alarms.filter((item) => item.workflowStatus !== "已关闭" && item.workflowStatus !== "已完成").length}
            </p>
            <p className="mt-2 text-xs text-[color:var(--text-muted)]">当前未完成闭环数量</p>
          </div>
        }
      />

      <SectionCard title="报警池" description="按状态和关键字快速定位当前值守中的报警。">
        <div className="sf-toolbar grid gap-3 p-3 md:grid-cols-[180px_minmax(0,1fr)]">
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as AlarmWorkflowStatus | "all");
              setPage(1);
            }}
            className={inputClassName}
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
            className={inputClassName}
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <div className="min-h-0 space-y-3 overflow-y-auto">
            {visibleAlarms.map((alarm) => (
              <button
                key={alarm.id}
                type="button"
                data-selected={selectedAlarm?.id === alarm.id ? "true" : "false"}
                onClick={() => {
                  setSelectedAlarmId(alarm.id);
                  setNote(alarm.detailNote);
                  setAttachments(alarm.attachments.join("\n"));
                  setAssignedUserName(alarm.assignedUserName);
                  setFalseAlarm(alarm.falseAlarm);
                }}
                className={`relative w-full overflow-hidden px-4 py-3 text-left transition-[border-color,background-color,box-shadow,transform] duration-180 ${
                  selectedAlarm?.id === alarm.id
                    ? "sf-list-row border-[color:var(--accent-strong)] bg-[color:var(--accent-soft)] shadow-[var(--panel-shadow-strong)] outline outline-1 outline-offset-[-1px] outline-[color:color-mix(in_srgb,var(--accent)_34%,var(--surface-contrast))]"
                    : "sf-list-row hover:-translate-y-[1px]"
                }`}
              >
                {selectedAlarm?.id === alarm.id ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 w-1.5 rounded-r-full bg-[color:var(--accent-strong)]"
                  />
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0 pr-3">
                    <p className="sf-label">{alarm.alarmType}</p>
                    <p
                      className={`mt-2 truncate text-[15px] font-semibold tracking-[-0.01em] ${
                        selectedAlarm?.id === alarm.id
                          ? "text-[color:var(--accent-strong)]"
                          : "text-[color:var(--text-primary)]"
                      }`}
                    >
                      {alarm.deviceName}
                    </p>
                    <p className="mt-1 truncate text-xs text-[color:var(--text-muted)]">{alarm.location}</p>
                  </div>
                  <StatusBadge status={alarm.workflowStatus} />
                </div>
                <div className="mt-2 flex flex-col gap-1 text-[11px] text-[color:var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
                  <span>{alarm.time}</span>
                  {alarm.falseAlarm ? <span className="text-[color:var(--warning-strong)]">已标记误报</span> : null}
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
          <div className="space-y-3">
              <div className="sf-panel-subtle p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="sf-label">Selected Alarm</p>
                    <h3 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-[color:var(--text-primary)]">
                      {selectedAlarm.alarmType}
                    </h3>
                    <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{selectedAlarm.deviceName}</p>
                    <p className="mt-1 text-sm text-[color:var(--text-muted)]">{selectedAlarm.location}</p>
                  </div>
                  <StatusBadge status={selectedAlarm.workflowStatus} />
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="text-[color:var(--text-secondary)]">处理状态</span>
                    <select
                      value={selectedAlarm.workflowStatus}
                      onChange={(event) => void updateAlarm(event.target.value as AlarmWorkflowStatus)}
                      disabled={saving}
                      className={inputClassName}
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
                      className={inputClassName}
                    />
                  </label>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="sf-checkrow px-3 py-2.5 text-sm">
                    <input type="checkbox" checked={falseAlarm} onChange={(event) => setFalseAlarm(event.target.checked)} />
                    <span>标记为误报</span>
                  </label>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void updateAlarm("已关闭")}
                    className="sf-button sf-button-danger h-10 px-4 text-sm disabled:opacity-60"
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
                    className="sf-input w-full px-3 py-3 text-sm"
                  />
                </label>

                <label className="mt-3 block space-y-1 text-sm">
                  <span className="text-[color:var(--text-secondary)]">附件（每行一个名称或链接）</span>
                  <textarea
                    value={attachments}
                    onChange={(event) => setAttachments(event.target.value)}
                    rows={3}
                    className="sf-input w-full px-3 py-3 text-sm"
                  />
                </label>

                {errorMessage ? (
                  <p className="mt-3 rounded-[14px] border border-[color:rgba(176,72,79,0.18)] bg-[color:var(--danger-soft)] px-3 py-2 text-sm text-[color:var(--danger-strong)]">
                    {errorMessage}
                  </p>
                ) : null}
              </div>

              <SectionCard title="处理时间轴" description="所有关键操作都记录到时间轴，供值守复盘和审计。">
                <div className="space-y-3">
                  {selectedAlarm.timeline.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-[16px] border border-[color:var(--border-soft)] bg-[linear-gradient(180deg,rgba(248,251,254,0.98)_0%,rgba(255,255,255,0.98)_100%)] px-4 py-3"
                    >
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        <p className="text-sm font-semibold tracking-[-0.01em] text-[color:var(--text-primary)]">
                          {item.action}
                        </p>
                        <span className="text-xs text-[color:var(--text-muted)]">{item.createdAt}</span>
                      </div>
                      <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                        {item.operatorName} / {item.operatorRole} / {item.fromStatus} → {item.toStatus}
                      </p>
                      {item.note ? <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{item.note}</p> : null}
                      {item.attachments.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.attachments.map((attachment) => (
                            <span
                              key={attachment}
                              className="rounded-full border border-[color:var(--border-soft)] bg-[color:rgba(255,255,255,0.82)] px-2.5 py-1 text-xs text-[color:var(--text-secondary)]"
                            >
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
            <div className="rounded-[16px] border border-dashed border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-12 text-center text-sm text-[color:var(--text-muted)]">
              当前没有报警数据。
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
