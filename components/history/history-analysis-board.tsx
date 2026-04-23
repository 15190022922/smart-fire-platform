"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import type { RawDeviceEventRecord } from "@/types/hardware";
import type { AlarmRecord, AlarmTypeStat } from "@/types/platform";
import type { TenantDeviceRecord } from "@/types/saas";

type HistoryPayload = {
  alarms: AlarmRecord[];
  rawEvents: RawDeviceEventRecord[];
  devices: TenantDeviceRecord[];
  exportedAt: string;
};

function parseLocalDateTime(value: string) {
  const normalized = value.trim().replace("T", " ");
  const [datePart, timePart = "00:00:00"] = normalized.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = timePart.split(":").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, second || 0);
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(value: string) {
  return parseLocalDateTime(`${value} 00:00:00`);
}

function endOfDay(value: string) {
  return parseLocalDateTime(`${value} 23:59:59`);
}

function formatDisplayDateTime(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}/${month}/${day} ${hour}:${minute}:${second}`;
}

function buildDailyTrend(alarms: AlarmRecord[]) {
  const grouped = new Map<string, number>();

  for (const alarm of alarms) {
    const key = alarm.time.slice(0, 10);
    grouped.set(key, (grouped.get(key) ?? 0) + 1);
  }

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, count]) => ({ date, count }));
}

function buildAlarmTypeStats(alarms: AlarmRecord[]): AlarmTypeStat[] {
  const grouped = new Map<string, number>();
  const colors = ["bg-rose-500", "bg-amber-500", "bg-sky-500", "bg-emerald-500", "bg-slate-500"];
  const total = alarms.length || 1;

  for (const alarm of alarms) {
    grouped.set(alarm.alarmType, (grouped.get(alarm.alarmType) ?? 0) + 1);
  }

  return Array.from(grouped.entries()).map(([label, count], index) => ({
    label,
    count,
    ratio: `${((count / total) * 100).toFixed(0)}%`,
    colorClass: colors[index % colors.length],
  }));
}

function downloadCsv(filename: string, rows: string[][]) {
  const csvContent = rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function HistoryAnalysisBoard({ initialData }: { initialData: HistoryPayload }) {
  const now = new Date();
  const [fromDate, setFromDate] = useState(toDateInputValue(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)));
  const [toDate, setToDate] = useState(toDateInputValue(now));
  const [deviceId, setDeviceId] = useState("all");
  const [processStatus, setProcessStatus] = useState("all");
  const [alarmType, setAlarmType] = useState("all");
  const [currentTime, setCurrentTime] = useState(() => formatDisplayDateTime(parseLocalDateTime(initialData.exportedAt)));

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(formatDisplayDateTime(new Date()));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const filteredAlarms = useMemo(() => {
    const from = startOfDay(fromDate);
    const to = endOfDay(toDate);

    return initialData.alarms.filter((alarm) => {
      const alarmDate = parseLocalDateTime(alarm.time);
      if (alarmDate < from || alarmDate > to) {
        return false;
      }
      if (processStatus !== "all" && alarm.processStatus !== processStatus) {
        return false;
      }
      if (alarmType !== "all" && alarm.alarmType !== alarmType) {
        return false;
      }
      if (deviceId !== "all") {
        const device = initialData.devices.find((item) => item.id === deviceId);
        if (!device || alarm.deviceName !== device.name) {
          return false;
        }
      }
      return true;
    });
  }, [alarmType, deviceId, fromDate, initialData.alarms, initialData.devices, processStatus, toDate]);

  const filteredEvents = useMemo(() => {
    const from = startOfDay(fromDate);
    const to = endOfDay(toDate);

    return initialData.rawEvents.filter((event) => {
      const eventDate = parseLocalDateTime(event.reportedAt);
      if (eventDate < from || eventDate > to) {
        return false;
      }
      if (deviceId !== "all" && event.deviceId !== deviceId) {
        return false;
      }
      return true;
    });
  }, [deviceId, fromDate, initialData.rawEvents, toDate]);

  const trend = useMemo(() => buildDailyTrend(filteredAlarms), [filteredAlarms]);
  const typeStats = useMemo(() => buildAlarmTypeStats(filteredAlarms), [filteredAlarms]);
  const maxTrendCount = Math.max(...trend.map((item) => item.count), 1);

  function exportAlarmDetail() {
    const rows = [
      ["导出时间", new Date().toLocaleString("zh-CN")],
      ["起始日期", fromDate],
      ["结束日期", toDate],
      [],
      ["报警时间", "设备名称", "位置", "报警类型", "处理状态"],
      ...filteredAlarms.map((alarm) => [
        alarm.time,
        alarm.deviceName,
        alarm.location,
        alarm.alarmType,
        alarm.processStatus,
      ]),
    ];

    downloadCsv(`报警明细_${fromDate}_${toDate}.csv`, rows);
  }

  function exportEventDetail() {
    const rows = [
      ["导出时间", new Date().toLocaleString("zh-CN")],
      ["起始日期", fromDate],
      ["结束日期", toDate],
      [],
      ["事件时间", "设备ID", "事件类型", "事件编码", "事件级别"],
      ...filteredEvents.map((event) => [
        event.reportedAt,
        event.deviceId,
        event.eventType,
        event.eventCode,
        event.eventLevel,
      ]),
    ];

    downloadCsv(`设备事件_${fromDate}_${toDate}.csv`, rows);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="数据分析"
        subtitle="按日查看报警历史、原始设备事件、处理进度和类型分布。支持筛选、明细核对和分别导出。"
        aside={
          <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[color:var(--text-secondary)]">
            <p>当前系统时间</p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">
              {currentTime || "--"}
            </p>
          </div>
        }
      />

      <SectionCard
        title="筛选条件"
        description="先按日期锁定范围，再按设备、处理状态或报警类型细查。"
        className="p-4 sm:p-4"
      >
        <div className="grid gap-3 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto_auto]">
          <label className="space-y-1.5 text-sm text-[color:var(--text-secondary)]">
            <span>开始日期</span>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="w-full rounded-2xl border border-[color:var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)]"
            />
          </label>
          <label className="space-y-1.5 text-sm text-[color:var(--text-secondary)]">
            <span>结束日期</span>
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="w-full rounded-2xl border border-[color:var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)]"
            />
          </label>
          <label className="space-y-1.5 text-sm text-[color:var(--text-secondary)]">
            <span>设备</span>
            <select
              value={deviceId}
              onChange={(event) => setDeviceId(event.target.value)}
              className="w-full rounded-2xl border border-[color:var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)]"
            >
              <option value="all">全部设备</option>
              {initialData.devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-sm text-[color:var(--text-secondary)]">
            <span>处理状态</span>
            <select
              value={processStatus}
              onChange={(event) => setProcessStatus(event.target.value)}
              className="w-full rounded-2xl border border-[color:var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)]"
            >
              <option value="all">全部状态</option>
              <option value="未处理">未处理</option>
              <option value="处理中">处理中</option>
              <option value="已处理">已处理</option>
            </select>
          </label>
          <label className="space-y-1.5 text-sm text-[color:var(--text-secondary)]">
            <span>报警类型</span>
            <select
              value={alarmType}
              onChange={(event) => setAlarmType(event.target.value)}
              className="w-full rounded-2xl border border-[color:var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)]"
            >
              <option value="all">全部类型</option>
              {Array.from(new Set(initialData.alarms.map((item) => item.alarmType))).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={exportAlarmDetail}
            className="self-end rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700"
          >
            导出报警明细
          </button>
          <button
            type="button"
            onClick={exportEventDetail}
            className="self-end rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700"
          >
            导出事件明细
          </button>
        </div>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
        <SectionCard
          title="报警趋势"
          description="按天统计，直接对应当前筛选范围。"
          className="p-4 sm:p-4"
        >
          <div className="rounded-3xl border border-[color:var(--border)] bg-[var(--surface-muted)] p-4">
            <svg viewBox="0 0 880 260" className="h-[260px] w-full">
              <defs>
                <linearGradient id="historyTrendFill" x1="0%" x2="0%" y1="0%" y2="100%">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {trend.map((item, index) => {
                const x = trend.length === 1 ? 440 : (index / Math.max(trend.length - 1, 1)) * 820 + 30;
                const y = 210 - (item.count / maxTrendCount) * 170;
                return (
                  <g key={item.date}>
                    {index > 0 ? (
                      <line
                        x1={trend.length === 1 ? 440 : ((index - 1) / Math.max(trend.length - 1, 1)) * 820 + 30}
                        y1={210 - (trend[index - 1].count / maxTrendCount) * 170}
                        x2={x}
                        y2={y}
                        stroke="#ef4444"
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                    ) : null}
                    <circle cx={x} cy={y} r="6" fill="#ef4444" />
                    <text x={x} y={235} textAnchor="middle" fontSize="12" fill="#64748b">
                      {item.date.slice(5)}
                    </text>
                    <text x={x} y={y - 12} textAnchor="middle" fontSize="12" fill="#0f172a">
                      {item.count}
                    </text>
                  </g>
                );
              })}
              <path
                d={
                  trend.length
                    ? `M 30 210 ${trend
                        .map((item, index) => {
                          const x = trend.length === 1 ? 440 : (index / Math.max(trend.length - 1, 1)) * 820 + 30;
                          const y = 210 - (item.count / maxTrendCount) * 170;
                          return `L ${x} ${y}`;
                        })
                        .join(" ")} L ${trend.length === 1 ? 440 : 850} 210 Z`
                    : ""
                }
                fill="url(#historyTrendFill)"
                stroke="none"
              />
            </svg>
          </div>
        </SectionCard>

        <SectionCard title="分布统计" description="快速看处理状态和报警类型。" className="p-4 sm:p-4">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                <p className="text-xs text-[color:var(--text-muted)]">报警总数</p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">{filteredAlarms.length}</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                <p className="text-xs text-[color:var(--text-muted)]">未处理</p>
                <p className="mt-2 text-2xl font-semibold text-rose-600">
                  {filteredAlarms.filter((item) => item.processStatus === "未处理").length}
                </p>
              </div>
              <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                <p className="text-xs text-[color:var(--text-muted)]">处理中</p>
                <p className="mt-2 text-2xl font-semibold text-amber-600">
                  {filteredAlarms.filter((item) => item.processStatus === "处理中").length}
                </p>
              </div>
            </div>

            <div className="max-h-[280px] space-y-3 overflow-y-auto pr-1">
              {typeStats.map((item) => (
                <div key={item.label}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 break-all text-[color:var(--text-secondary)]">{item.label}</span>
                    <span className="shrink-0 text-[color:var(--text-muted)]">
                      {item.count} / {item.ratio}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-[var(--surface-muted)]">
                    <div className={`h-2.5 rounded-full ${item.colorClass}`} style={{ width: item.ratio }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <SectionCard title="报警历史明细" description="精确到天，支持按状态和设备核对。" className="p-4 sm:p-4">
          <div className="max-h-[520px] overflow-auto rounded-2xl border border-[color:var(--border)]">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-[var(--surface-strong)] text-[color:var(--text-secondary)]">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">时间</th>
                  <th className="px-4 py-3 text-left font-medium">设备</th>
                  <th className="px-4 py-3 text-left font-medium">位置</th>
                  <th className="px-4 py-3 text-left font-medium">类型</th>
                  <th className="px-4 py-3 text-left font-medium">处理状态</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlarms.map((alarm) => (
                  <tr key={alarm.id} className="border-t border-[color:var(--border)] bg-[var(--surface)]">
                    <td className="whitespace-nowrap px-4 py-3">{alarm.time}</td>
                    <td className="px-4 py-3">{alarm.deviceName}</td>
                    <td className="px-4 py-3">{alarm.location}</td>
                    <td className="px-4 py-3">{alarm.alarmType}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={alarm.processStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="原始设备事件" description="保留接入层事件，便于对照硬件上报。" className="p-4 sm:p-4">
          <div className="max-h-[520px] overflow-auto rounded-2xl border border-[color:var(--border)]">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-[var(--surface-strong)] text-[color:var(--text-secondary)]">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">时间</th>
                  <th className="px-4 py-3 text-left font-medium">设备ID</th>
                  <th className="px-4 py-3 text-left font-medium">事件类型</th>
                  <th className="px-4 py-3 text-left font-medium">事件编码</th>
                  <th className="px-4 py-3 text-left font-medium">级别</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event) => (
                  <tr key={event.id} className="border-t border-[color:var(--border)] bg-[var(--surface)]">
                    <td className="whitespace-nowrap px-4 py-3">{event.reportedAt}</td>
                    <td className="px-4 py-3">{event.deviceId}</td>
                    <td className="px-4 py-3">{event.eventType}</td>
                    <td className="px-4 py-3">{event.eventCode}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-1 text-xs">
                        {event.eventLevel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
