"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { alarmWorkflowStatuses } from "@/packages/shared/src/contracts";
import type { AlarmRecord } from "@/types/platform";
import type { AlarmWorkflowStatus } from "@/types/ops";

type RealtimeStatus = "connecting" | "connected" | "reconnecting" | "stale";

const MAX_PAGE_SIZE = 5;
const MIN_PAGE_SIZE = 1;
const TABLE_BODY_VERTICAL_CHROME = 18;
const TABLE_HEADER_HEIGHT = 36;
const TABLE_ROW_HEIGHT = 58;
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
  connecting: "border-[color:var(--border-soft)] bg-[var(--warning-soft)] text-[var(--warning-strong)]",
  connected: "border-[color:var(--border-soft)] bg-[var(--success-soft)] text-[var(--success-strong)]",
  reconnecting: "border-[color:var(--border-soft)] bg-[var(--danger-soft)] text-[var(--danger-strong)]",
  stale: "border-[color:var(--border-soft)] bg-[var(--neutral-soft)] text-[color:var(--text-secondary)]",
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
  if (label === "未处理") return "border-[color:var(--border-soft)] bg-[var(--danger-soft)] text-[var(--danger-strong)]";
  if (label === "处理中") return "border-[color:var(--border-soft)] bg-[var(--warning-soft)] text-[var(--warning-strong)]";
  return "border-[color:var(--border-soft)] bg-[var(--success-soft)] text-[var(--success-strong)]";
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

function clampPageSize(value: number) {
  return Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, value));
}

function pageSizeFromBodyHeight(height: number) {
  const availableRowHeight = height - TABLE_BODY_VERTICAL_CHROME - TABLE_HEADER_HEIGHT;
  return clampPageSize(Math.floor(availableRowHeight / TABLE_ROW_HEIGHT));
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
  const [pageSize, setPageSize] = useState(MAX_PAGE_SIZE);
  const [measuredBodyHeight, setMeasuredBodyHeight] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);

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

  const effectivePageSize = measuredBodyHeight > 0 ? pageSize : MAX_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(sortedAlarms.length / effectivePageSize));
  const safePage = Math.min(page, totalPages);
  const visibleAlarms = sortedAlarms.slice((safePage - 1) * effectivePageSize, safePage * effectivePageSize);

  useEffect(() => {
    const target = bodyRef.current;
    if (!target) return;

    let frame = 0;
    const updateHeight = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const nextHeight = Math.max(0, Math.floor(target.getBoundingClientRect().height));
        setMeasuredBodyHeight((current) => (current === nextHeight ? current : nextHeight));
        const nextPageSize = pageSizeFromBodyHeight(nextHeight);
        setPageSize((current) => (current === nextPageSize ? current : nextPageSize));
      });
    };

    updateHeight();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateHeight);
      return () => {
        window.cancelAnimationFrame(frame);
        window.removeEventListener("resize", updateHeight);
      };
    }

    const observer = new ResizeObserver(updateHeight);
    observer.observe(target);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (page <= totalPages) return;
    const frame = window.requestAnimationFrame(() => setPage(totalPages));
    return () => window.cancelAnimationFrame(frame);
  }, [page, totalPages]);

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
            <StatusBadge status={`跨日 ${panelStats.carryoverCount}`} tone="purple" className="shrink-0 py-0.5 text-[10px]" />
          ) : null}
        </div>
        {errorMessage ? <p className="mt-1 truncate text-[11px] font-medium text-[color:var(--danger-strong)]">{errorMessage}</p> : null}
      </div>

      <div ref={bodyRef} className="relative z-10 min-h-0 bg-[var(--panel-body-bg)] px-2 py-2">
        {visibleAlarms.length > 0 ? (
          <div className="h-full min-h-0 overflow-visible rounded-[12px] border border-[color:var(--panel-divider)] bg-[var(--panel-cell-bg)] shadow-[var(--panel-inset)] backdrop-blur-xl">
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
                        {alarm.isCarryover ? <div className="mt-1"><StatusBadge status="跨日" className="px-2 py-0.5 text-[10px]" /></div> : null}
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
                            className={`flex h-8 w-full items-center justify-between gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold outline-none shadow-[var(--panel-inset)] transition focus:ring-2 focus:ring-[color:var(--field-ring)] disabled:cursor-not-allowed disabled:opacity-60 ${statusClass(normalizedStatus)}`}
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
          <div className="flex h-full min-h-0 items-center justify-center rounded-[10px] border border-dashed border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-4 text-center text-sm text-[color:var(--text-muted)]">
            当前没有需要值守的警情
          </div>
        )}
      </div>

      <div className="relative z-10 flex items-center justify-between border-t border-[color:var(--panel-divider)] bg-[var(--panel-header-bg)] px-3 py-2 text-[11px] text-[color:var(--text-secondary)]">
        <span>
          {sortedAlarms.length} 条，{safePage}/{totalPages} 页，每页 {effectivePageSize} 条
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
