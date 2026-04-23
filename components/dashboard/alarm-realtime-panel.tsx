"use client";

import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import type { AlarmRecord } from "@/types/platform";

type RealtimeStatus = "connecting" | "connected" | "reconnecting" | "stale";

const processStatusOptions: AlarmRecord["processStatus"][] = ["未处理", "处理中", "已处理"];

const realtimeStatusStyle: Record<RealtimeStatus, string> = {
  connecting: "border-amber-200 bg-amber-50 text-amber-700",
  connected: "border-emerald-200 bg-emerald-50 text-emerald-700",
  reconnecting: "border-rose-200 bg-rose-50 text-rose-700",
  stale: "border-slate-200 bg-slate-100 text-slate-700",
};

const realtimeStatusLabel: Record<RealtimeStatus, string> = {
  connecting: "实时连接中",
  connected: "实时已连接",
  reconnecting: "连接重试中",
  stale: "实时链路延迟",
};

function normalizeProcessStatus(status: AlarmRecord["processStatus"]): "未处理" | "处理中" | "已处理" {
  if (status === "未处理" || status === "閺堫亜顦╅悶?" || status === "闁哄牜浜滈ˇ鈺呮偠?") {
    return "未处理";
  }
  if (status === "处理中" || status === "婢跺嫮鎮婃稉?" || status === "濠㈣泛瀚幃濠冪▔?") {
    return "处理中";
  }
  return "已处理";
}

function parseLocalDateTime(value: string) {
  const normalized = value.trim().replace("T", " ");
  const [datePart, timePart = "00:00:00"] = normalized.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = timePart.split(":").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, second || 0);
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
  const [errorMessage, setErrorMessage] = useState("");

  const panelStats = useMemo(() => {
    const activeCount = alarms.filter((alarm) => alarm.isActive).length;
    const carryoverCount = alarms.filter((alarm) => alarm.isCarryover).length;
    const todayCount = alarms.length - carryoverCount;

    return {
      total: alarms.length,
      activeCount,
      carryoverCount,
      todayCount,
    };
  }, [alarms]);

  const sortedAlarms = useMemo(() => {
    return [...alarms].sort((left, right) => {
      const leftPriority = left.isActive ? 0 : 1;
      const rightPriority = right.isActive ? 0 : 1;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return parseLocalDateTime(right.time).getTime() - parseLocalDateTime(left.time).getTime();
    });
  }, [alarms]);

  async function handleStatusChange(alarmId: string, processStatus: AlarmRecord["processStatus"]) {
    setUpdatingAlarmId(alarmId);
    setErrorMessage("");

    try {
      const response = await fetch("/api/tenant/alarms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alarmId, processStatus }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message || `HTTP ${response.status}`);
      }

      await onRefresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "更新报警状态失败");
    } finally {
      setUpdatingAlarmId(null);
    }
  }

  return (
    <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] rounded-[20px] border border-[color:var(--border-strong)] bg-[var(--surface)] shadow-[var(--panel-shadow)]">
      <div className="space-y-2 border-b border-[color:var(--border)] px-3 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-[color:var(--text-primary)]">实时警情</h2>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${realtimeStatusStyle[realtimeStatus]}`}>
              {realtimeStatusLabel[realtimeStatus]}
            </span>
          </div>
          {errorMessage ? <span className="text-[11px] font-medium text-rose-600">{errorMessage}</span> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 font-medium text-rose-700">
            当前显示 {panelStats.total} 条
          </span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
            未闭环 {panelStats.activeCount} 条
          </span>
          <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 font-medium text-sky-700">
            今日 {panelStats.todayCount} 条
          </span>
          {panelStats.carryoverCount > 0 ? (
            <span className="rounded-full border border-fuchsia-200 bg-fuchsia-50 px-2.5 py-1 font-medium text-fuchsia-700">
              跨日遗留 {panelStats.carryoverCount} 条
            </span>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 space-y-2 overflow-y-auto px-2.5 py-3 pb-4">
        {sortedAlarms.map((alarm) => {
          const isUpdating = updatingAlarmId === alarm.id;
          const normalizedStatus = normalizeProcessStatus(alarm.processStatus);

          return (
            <article
              key={alarm.id}
              className={`rounded-xl border px-3 py-2.5 ${
                normalizedStatus === "未处理"
                  ? "border-rose-200 bg-rose-50/80"
                  : normalizedStatus === "处理中"
                    ? "border-amber-200 bg-amber-50/80"
                    : "border-[color:var(--field-border)] bg-[var(--table-row-alt)]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-rose-700">{alarm.alarmType}</p>
                    {alarm.isCarryover ? (
                      <span className="rounded-full border border-fuchsia-200 bg-fuchsia-50 px-2 py-0.5 text-[10px] font-medium text-fuchsia-700">
                        跨日未闭环
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-xs text-[color:var(--text-primary)]">{alarm.deviceName}</p>
                  <p className="mt-1 truncate text-[11px] text-[color:var(--text-secondary)]">{alarm.location}</p>
                </div>
                <StatusBadge status={normalizedStatus} />
              </div>

              <div className="mt-2 grid gap-1 text-[11px] text-[color:var(--text-secondary)]">
                <div className="flex items-center justify-between gap-2">
                  <span>报警时间</span>
                  <span className="font-semibold text-[color:var(--text-primary)]">{alarm.time}</span>
                </div>
              </div>

              <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <span className="text-[11px] text-[color:var(--text-muted)]">处理状态</span>
                <select
                  value={normalizedStatus}
                  disabled={isUpdating}
                  onChange={(event) => void handleStatusChange(alarm.id, event.target.value as AlarmRecord["processStatus"])}
                  className="rounded-full border border-[color:var(--field-border)] bg-[var(--field-bg)] px-3 py-1 text-xs text-[color:var(--text-primary)] outline-none transition focus:border-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {processStatusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </article>
          );
        })}

        {sortedAlarms.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-8 text-center text-sm text-[color:var(--text-muted)]">
            当前没有需要值守的警情。
            <div className="mt-2 text-xs text-[color:var(--text-muted)]">
              跨日已闭环报警会自动从本列表移出，完整历史记录请到“数据分析”查看。
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
