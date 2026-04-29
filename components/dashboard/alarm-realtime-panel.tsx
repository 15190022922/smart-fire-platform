"use client";

import { useMemo, useState } from "react";
import { alarmWorkflowStatuses } from "@/packages/shared/src/contracts";
import type { AlarmRecord } from "@/types/platform";
import type { AlarmWorkflowStatus } from "@/types/ops";

type RealtimeStatus = "connecting" | "connected" | "reconnecting" | "stale";

const PAGE_SIZE = 5;
const pendingStatus = alarmWorkflowStatuses[0] as AlarmWorkflowStatus;
const processingStatus = alarmWorkflowStatuses[2] as AlarmWorkflowStatus;
const completedStatus = alarmWorkflowStatuses[3] as AlarmWorkflowStatus;
const processStatusOptions = [pendingStatus, processingStatus, completedStatus] as const;

const statusLabels = new Map<string, string>([
  [pendingStatus, "未处理"],
  [processingStatus, "处理中"],
  [completedStatus, "已处理"],
  ["未处理", "未处理"],
  ["处理中", "处理中"],
  ["已处理", "已处理"],
  ["已完成", "已处理"],
]);

const realtimeStatusStyle: Record<RealtimeStatus, string> = {
  connecting: "border-[rgba(169,107,34,0.18)] bg-[var(--warning-soft)] text-[var(--warning-strong)]",
  connected: "border-[rgba(57,118,91,0.16)] bg-[var(--success-soft)] text-[var(--success-strong)]",
  reconnecting: "border-[rgba(176,72,79,0.18)] bg-[var(--danger-soft)] text-[var(--danger-strong)]",
  stale: "border-[rgba(107,125,145,0.18)] bg-[var(--neutral-soft)] text-[color:var(--text-secondary)]",
};

const realtimeStatusLabel: Record<RealtimeStatus, string> = {
  connecting: "连接中",
  connected: "实时在线",
  reconnecting: "重连中",
  stale: "链路延迟",
};

function normalizeProcessStatus(status: string): AlarmWorkflowStatus {
  const label = statusLabels.get(status);
  if (label === "处理中") return processingStatus;
  if (label === "已处理") return completedStatus;
  return pendingStatus;
}

function displayStatus(status: string) {
  return statusLabels.get(status) ?? status;
}

function statusClass(status: string) {
  const label = displayStatus(status);
  if (label === "未处理") return "border-[rgba(176,72,79,0.18)] bg-[var(--danger-soft)] text-[var(--danger-strong)]";
  if (label === "处理中") return "border-[rgba(169,107,34,0.2)] bg-[var(--warning-soft)] text-[var(--warning-strong)]";
  return "border-[rgba(57,118,91,0.16)] bg-[var(--success-soft)] text-[var(--success-strong)]";
}

function parseLocalDateTime(value: string) {
  const normalized = value.trim().replace("T", " ");
  const [datePart, timePart = "00:00:00"] = normalized.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = timePart.split(":").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, second || 0);
}

function displayDateTime(value: string) {
  const normalized = value.trim().replace("T", " ");
  const [datePart, timePart = "00:00:00"] = normalized.split(" ");
  return `${datePart} ${timePart.slice(0, 8)}`;
}

export function AlarmRealtimePanel({
  alarms,
  realtimeStatus,
  onRefresh,
}: {
  alarms: AlarmRecord[];
  realtimeStatus: RealtimeStatus;
  onRefresh: () => Promise<void>;
}) {
  const [updatingAlarmId, setUpdatingAlarmId] = useState<string | null>(null);
  const [openStatusMenuId, setOpenStatusMenuId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [page, setPage] = useState(1);

  const panelStats = useMemo(() => {
    const activeCount = alarms.filter((alarm) => alarm.isActive).length;
    const carryoverCount = alarms.filter((alarm) => alarm.isCarryover).length;
    return {
      total: alarms.length,
      activeCount,
      todayCount: alarms.length - carryoverCount,
      carryoverCount,
    };
  }, [alarms]);

  const sortedAlarms = useMemo(() => {
    return [...alarms].sort((left, right) => {
      const leftPriority = left.isActive ? 0 : 1;
      const rightPriority = right.isActive ? 0 : 1;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      return parseLocalDateTime(right.time).getTime() - parseLocalDateTime(left.time).getTime();
    });
  }, [alarms]);

  const totalPages = Math.max(1, Math.ceil(sortedAlarms.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleAlarms = sortedAlarms.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  async function handleStatusChange(alarmId: string, processStatus: AlarmWorkflowStatus) {
    setUpdatingAlarmId(alarmId);
    setErrorMessage("");

    try {
      const response = await fetch("/api/tenant/alarms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alarmId, nextStatus: processStatus }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message || `HTTP ${response.status}`);
      }

      await onRefresh();
      setOpenStatusMenuId(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "更新报警状态失败");
    } finally {
      setUpdatingAlarmId(null);
    }
  }

  return (
    <section className="sf-glass-strong relative grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[18px]">
      <div className="relative z-10 border-b border-[color:var(--panel-divider)] bg-[var(--panel-header-bg)] px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="shrink-0 text-sm font-semibold tracking-[-0.01em] text-[color:var(--text-primary)]">实时警情</h2>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${realtimeStatusStyle[realtimeStatus]}`}>
              {realtimeStatusLabel[realtimeStatus]}
            </span>
            <span className="truncate text-[11px] text-[color:var(--text-muted)]">
              当前 {panelStats.total} 条 / 未闭环 {panelStats.activeCount} / 今日 {panelStats.todayCount}
            </span>
          </div>
          {panelStats.carryoverCount > 0 ? (
            <span className="shrink-0 rounded-full border border-[rgba(117,74,160,0.18)] bg-[rgba(247,242,255,0.95)] px-2 py-0.5 text-[10px] font-semibold text-[rgb(108,57,151)]">
              跨日 {panelStats.carryoverCount}
            </span>
          ) : null}
        </div>
        {errorMessage ? <p className="mt-1 truncate text-[11px] font-medium text-rose-600">{errorMessage}</p> : null}
      </div>

      <div className="relative z-10 min-h-0 bg-[var(--panel-body-bg)] px-2 py-2">
        {visibleAlarms.length > 0 ? (
          <div className="overflow-visible rounded-[12px] border border-[color:var(--panel-divider)] bg-[var(--panel-cell-bg)] shadow-[var(--panel-inset)] backdrop-blur-xl">
            <table className="w-full table-fixed border-separate border-spacing-0 text-left text-[11px]">
              <thead className="bg-[var(--table-head)] text-[color:var(--text-muted)]">
                <tr>
                  <th className="w-[132px] border-r border-[color:var(--panel-divider-strong)] px-2.5 py-2 font-semibold">时间</th>
                  <th className="border-r border-[color:var(--panel-divider-strong)] px-2.5 py-2 font-semibold">设备 / 位置</th>
                  <th className="w-[78px] border-r border-[color:var(--panel-divider-strong)] px-2.5 py-2 font-semibold">类型</th>
                  <th className="w-[112px] px-2.5 py-2 font-semibold">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--panel-divider-strong)]">
                {visibleAlarms.map((alarm, index) => {
                  const normalizedStatus = normalizeProcessStatus(alarm.processStatus);
                  const isUpdating = updatingAlarmId === alarm.id;
                  const isStatusMenuOpen = openStatusMenuId === alarm.id;
                  const menuPositionClass = index >= visibleAlarms.length - 2 ? "bottom-full mb-1" : "top-full mt-1";
                  return (
                    <tr key={alarm.id} className="hover:bg-[var(--surface-muted)]">
                      <td className="whitespace-nowrap border-r border-[color:var(--panel-divider-strong)] px-2.5 py-2 font-semibold tabular-nums leading-5 text-[color:var(--text-primary)]">
                        {displayDateTime(alarm.time)}
                      </td>
                      <td className="min-w-0 border-r border-[color:var(--panel-divider-strong)] px-2.5 py-2">
                        <div className="truncate font-semibold text-[color:var(--text-primary)]">{alarm.deviceName}</div>
                        <div className="truncate text-[11px] text-[color:var(--text-muted)]">{alarm.location}</div>
                      </td>
                      <td className="border-r border-[color:var(--panel-divider-strong)] px-2.5 py-2">
                        <div className="truncate text-[color:var(--text-secondary)]">{alarm.alarmType}</div>
                        {alarm.isCarryover ? <div className="mt-0.5 text-[10px] font-semibold text-[rgb(108,57,151)]">跨日</div> : null}
                      </td>
                      <td className="px-2.5 py-2">
                        <div
                          className="relative"
                          onBlur={(event) => {
                            const nextTarget = event.relatedTarget;
                            if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
                              setOpenStatusMenuId(null);
                            }
                          }}
                        >
                          <button
                            type="button"
                            disabled={isUpdating}
                            aria-haspopup="listbox"
                            aria-expanded={isStatusMenuOpen}
                            onClick={() => setOpenStatusMenuId((current) => (current === alarm.id ? null : alarm.id))}
                            className={`flex h-8 w-full items-center justify-between gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold outline-none shadow-[var(--panel-inset)] transition focus:ring-2 focus:ring-zinc-500/20 disabled:cursor-not-allowed disabled:opacity-60 ${statusClass(normalizedStatus)}`}
                          >
                            <span className="truncate">{displayStatus(normalizedStatus)}</span>
                            <span className="text-[10px] font-bold text-[color:var(--text-muted)]">v</span>
                          </button>
                          {isStatusMenuOpen ? (
                            <div
                              role="listbox"
                              className={`absolute right-0 z-30 w-[126px] rounded-[12px] border border-[color:var(--panel-divider)] bg-[var(--panel-menu-bg)] p-1 shadow-[var(--panel-shadow-strong)] backdrop-blur-xl ${menuPositionClass}`}
                            >
                              {processStatusOptions.map((option) => {
                                const isSelected = option === normalizedStatus;
                                return (
                                  <button
                                    key={option}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => {
                                      if (isSelected) {
                                        setOpenStatusMenuId(null);
                                        return;
                                      }
                                      void handleStatusChange(alarm.id, option);
                                    }}
                                    className={`w-full rounded-[9px] px-2.5 py-1.5 text-left text-[11px] font-semibold transition ${
                                      isSelected
                                        ? "bg-[var(--surface-muted)] text-[color:var(--text-primary)]"
                                        : "text-[color:var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                                    }`}
                                  >
                                    {displayStatus(option)}
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-[10px] border border-dashed border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-6 text-center text-sm text-[color:var(--text-muted)]">
            当前没有需要值守的警情
          </div>
        )}
      </div>

      <div className="relative z-10 flex items-center justify-between border-t border-[color:var(--panel-divider)] bg-[var(--panel-header-bg)] px-3 py-2 text-[11px] text-[color:var(--text-secondary)]">
        <span>
          {sortedAlarms.length} 条，{safePage}/{totalPages} 页
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="sf-button sf-button-secondary h-7 px-2 text-[11px] disabled:cursor-not-allowed disabled:opacity-40"
          >
            上一页
          </button>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            className="sf-button sf-button-secondary h-7 px-2 text-[11px] disabled:cursor-not-allowed disabled:opacity-40"
          >
            下一页
          </button>
        </div>
      </div>
    </section>
  );
}
