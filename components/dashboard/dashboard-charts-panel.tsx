"use client";

import { useMemo, useState } from "react";
import { AlarmTrendPoint, AlarmTypeStat, DeviceOverview } from "@/types/platform";

function buildPolyline(data: AlarmTrendPoint[], maxValue: number, height: number, width: number) {
  return data
    .map((item, index) => {
      const x = data.length === 1 ? width / 2 : (index / (data.length - 1)) * width;
      const y = height - (item.total / maxValue) * height;
      return `${x},${y}`;
    })
    .join(" ");
}

function groupTrendData(data: AlarmTrendPoint[], interval: number) {
  const chunkSize = Math.max(1, interval / 60);
  const grouped: AlarmTrendPoint[] = [];

  for (let index = 0; index < data.length; index += chunkSize) {
    const chunk = data.slice(index, index + chunkSize);
    grouped.push({
      label:
        chunk.length > 1
          ? `${chunk[0].label}-${chunk[chunk.length - 1].label}`
          : chunk[0].label,
      total: chunk.reduce((sum, item) => sum + item.total, 0),
      pending: chunk.reduce((sum, item) => sum + item.pending, 0),
      handled: chunk.reduce((sum, item) => sum + item.handled, 0),
    });
  }

  return grouped;
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

export function DashboardChartsPanel({
  trendData,
  overview,
  typeStats,
}: {
  trendData: AlarmTrendPoint[];
  overview: DeviceOverview;
  typeStats: AlarmTypeStat[];
}) {
  const [interval, setInterval] = useState(60);
  const groupedTrendData = useMemo(() => groupTrendData(trendData, interval), [interval, trendData]);
  const width = 480;
  const height = 78;
  const maxValue = Math.max(...groupedTrendData.map((item) => item.total), 1);
  const polyline = buildPolyline(groupedTrendData, maxValue, height, width);
  const visibleBreakdown = overview.breakdown.slice(0, 4);

  function handleExport() {
    const rows: string[][] = [
      ["报表导出时间", new Date().toLocaleString("zh-CN")],
      [],
      ["报警趋势间隔", `${interval} 分钟`],
      ["时间段", "总报警", "未处理", "已处理"],
      ...groupedTrendData.map((item) => [
        item.label,
        String(item.total),
        String(item.pending),
        String(item.handled),
      ]),
      [],
      ["设备状态", "数量", "占比"],
      ...visibleBreakdown.map((item) => [item.label, String(item.count), item.ratio]),
      [],
      ["报警类型", "数量", "占比"],
      ...typeStats.map((item) => [item.label, String(item.count), item.ratio]),
    ];

    downloadCsv("智慧消防平台报表.csv", rows);
  }

  return (
    <section className="grid h-full min-h-0 gap-3 xl:grid-cols-[minmax(0,1.28fr)_minmax(0,0.92fr)_minmax(0,1fr)]">
      <article className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] rounded-[22px] border border-[color:var(--border-strong)] bg-[var(--surface)] shadow-[var(--panel-shadow)]">
        <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border)] px-4 py-2.5">
          <h2 className="text-sm font-semibold text-[color:var(--text-primary)]">报警趋势曲线图</h2>
          <div className="flex items-center gap-2">
            <select
              value={interval}
              onChange={(event) => setInterval(Number(event.target.value))}
              className="rounded-full border border-[color:var(--border)] bg-[var(--surface-strong)] px-3 py-1.5 text-xs text-[color:var(--text-secondary)] outline-none transition focus:border-sky-300"
            >
              <option value={60}>60 分钟</option>
              <option value={120}>120 分钟</option>
              <option value={240}>240 分钟</option>
            </select>
            <button
              type="button"
              onClick={handleExport}
              className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 transition hover:bg-sky-100"
            >
              导出报表
            </button>
          </div>
        </div>
        <div className="px-4 py-3">
          <svg viewBox={`0 0 ${width} ${height + 18}`} className="h-20 w-full">
            <defs>
              <linearGradient id="compactTrendFill" x1="0%" x2="0%" y1="0%" y2="100%">
                <stop offset="0%" stopColor="#f97316" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#f97316" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <polyline
              fill="url(#compactTrendFill)"
              stroke="none"
              points={`0,${height} ${polyline} ${width},${height}`}
            />
            <polyline
              fill="none"
              stroke="#f97316"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={polyline}
            />
          </svg>
          <div
            className="mt-1 grid gap-1 text-center text-[11px] text-[color:var(--text-muted)]"
            style={{ gridTemplateColumns: `repeat(${groupedTrendData.length}, minmax(0, 1fr))` }}
          >
            {groupedTrendData.map((item) => (
              <div key={item.label}>
                <p className="font-medium text-[color:var(--text-primary)]">{item.total}</p>
                <p className="truncate">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </article>

      <article className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] rounded-[22px] border border-[color:var(--border-strong)] bg-[var(--surface)] shadow-[var(--panel-shadow)]">
        <div className="border-b border-[color:var(--border)] px-4 py-2.5">
          <h2 className="text-sm font-semibold text-[color:var(--text-primary)]">设备状态统计</h2>
        </div>
        <div className="grid grid-cols-4 items-end gap-3 px-4 py-3">
          {visibleBreakdown.map((item) => (
            <div key={item.label} className="flex h-full flex-col justify-end">
              <div className="mb-2 text-center">
                <p className="text-lg font-semibold text-[color:var(--text-primary)]">{item.count}</p>
                <p className="text-[11px] text-[color:var(--text-muted)]">{item.label}</p>
              </div>
              <div className="flex h-full items-end justify-center rounded-t-xl bg-[var(--surface-muted)] px-2 pb-0">
                <div className={`w-10 rounded-t-xl ${item.barClass}`} style={{ height: item.ratio }} />
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] rounded-[22px] border border-[color:var(--border-strong)] bg-[var(--surface)] shadow-[var(--panel-shadow)]">
        <div className="border-b border-[color:var(--border)] px-4 py-2.5">
          <h2 className="text-sm font-semibold text-[color:var(--text-primary)]">报警类型分布</h2>
        </div>
        <div className="space-y-3 px-4 py-3">
          {typeStats.map((item) => (
            <div key={item.label}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px]">
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
      </article>
    </section>
  );
}
