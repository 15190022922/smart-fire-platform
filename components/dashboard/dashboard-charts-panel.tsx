"use client";

import { useMemo } from "react";
import type { AlarmTrendPoint, AlarmTypeStat, DeviceOverview } from "@/types/platform";

function buildPolyline(values: number[], maxValue: number, height: number, width: number) {
  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - (value / maxValue) * height;
      return `${x},${y}`;
    })
    .join(" ");
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
  const width = 480;
  const height = 82;
  const visibleBreakdown = overview.breakdown.slice(0, 4);

  const chartData = useMemo(() => {
    return trendData.map((item) => ({
      label: item.label,
      total: item.total,
      pending: item.pending,
      handled: item.handled,
    }));
  }, [trendData]);

  const maxValue = Math.max(...chartData.flatMap((item) => [item.total, item.pending, item.handled]), 1);

  const totalPolyline = buildPolyline(
    chartData.map((item) => item.total),
    maxValue,
    height,
    width,
  );
  const pendingPolyline = buildPolyline(
    chartData.map((item) => item.pending),
    maxValue,
    height,
    width,
  );
  const handledPolyline = buildPolyline(
    chartData.map((item) => item.handled),
    maxValue,
    height,
    width,
  );

  function handleExport() {
    const rows: string[][] = [
      ["导出时间", new Date().toLocaleString("zh-CN", { hour12: false })],
      [],
      ["时间段", "新增报警", "未闭环", "已处理"],
      ...chartData.map((item) => [item.label, String(item.total), String(item.pending), String(item.handled)]),
      [],
      ["设备状态", "数量", "占比"],
      ...visibleBreakdown.map((item) => [item.label, String(item.count), item.ratio]),
      [],
      ["报警类型", "数量", "占比"],
      ...typeStats.map((item) => [item.label, String(item.count), item.ratio]),
    ];

    downloadCsv("消防平台首页分析.csv", rows);
  }

  return (
    <section className="grid h-full min-h-0 gap-2 xl:grid-cols-[minmax(0,1.42fr)_minmax(0,0.82fr)_minmax(0,1.02fr)]">
      <article className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] rounded-[20px] border border-[color:var(--border-strong)] bg-[var(--surface)] shadow-[var(--panel-shadow)]">
        <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border)] px-3 py-2">
          <div>
            <h2 className="text-sm font-semibold text-[color:var(--text-primary)]">近 6 小时警情变化</h2>
            <p className="text-[11px] text-[color:var(--text-muted)]">同时查看新增报警、未闭环数量和已处理数量</p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 transition hover:bg-sky-100"
          >
            导出
          </button>
        </div>
        <div className="px-3 py-2">
          <svg viewBox={`0 0 ${width} ${height + 18}`} className="h-24 w-full">
            <polyline fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={totalPolyline} />
            <polyline fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={pendingPolyline} />
            <polyline fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={handledPolyline} />
          </svg>

          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px]">
            <span className="inline-flex items-center gap-1 text-[color:var(--text-secondary)]">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              新增报警
            </span>
            <span className="inline-flex items-center gap-1 text-[color:var(--text-secondary)]">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              未闭环
            </span>
            <span className="inline-flex items-center gap-1 text-[color:var(--text-secondary)]">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              已处理
            </span>
          </div>

          <div
            className="mt-2 grid gap-1 text-center text-[11px] text-[color:var(--text-muted)]"
            style={{ gridTemplateColumns: `repeat(${Math.max(chartData.length, 1)}, minmax(0, 1fr))` }}
          >
            {chartData.map((item) => (
              <div key={item.label}>
                <p className="font-medium text-[color:var(--text-primary)]">{item.total}</p>
                <p className="truncate">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </article>

      <article className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] rounded-[20px] border border-[color:var(--border-strong)] bg-[var(--surface)] shadow-[var(--panel-shadow)]">
        <div className="border-b border-[color:var(--border)] px-3 py-2">
          <h2 className="text-sm font-semibold text-[color:var(--text-primary)]">设备状态</h2>
        </div>
        <div className="grid grid-cols-4 items-end gap-2 px-3 py-2">
          {visibleBreakdown.map((item) => (
            <div key={item.label} className="flex h-full flex-col justify-end">
              <div className="mb-1 text-center">
                <p className="text-lg font-semibold text-[color:var(--text-primary)]">{item.count}</p>
                <p className="text-[11px] text-[color:var(--text-muted)]">{item.label}</p>
              </div>
              <div className="flex h-full items-end justify-center rounded-t-xl bg-[var(--surface-muted)] px-2 pb-0">
                <div className={`w-9 rounded-t-xl ${item.barClass}`} style={{ height: item.ratio }} />
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] rounded-[20px] border border-[color:var(--border-strong)] bg-[var(--surface)] shadow-[var(--panel-shadow)]">
        <div className="border-b border-[color:var(--border)] px-3 py-2">
          <h2 className="text-sm font-semibold text-[color:var(--text-primary)]">报警类型分布</h2>
        </div>
        <div className="min-h-0 space-y-2 overflow-y-auto px-3 py-2">
          {typeStats.map((item) => (
            <div key={item.label}>
              <div className="mb-1 flex items-center justify-between gap-3 text-[11px]">
                <span className="min-w-0 whitespace-normal break-all text-[color:var(--text-secondary)]">{item.label}</span>
                <span className="shrink-0 text-[color:var(--text-muted)]">
                  {item.count} / {item.ratio}
                </span>
              </div>
              <div className="h-2 rounded-full bg-[var(--surface-muted)]">
                <div className={`h-2 rounded-full ${item.colorClass}`} style={{ width: item.ratio }} />
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
