import { DashboardMetric } from "@/types/platform";

const toneClassMap = {
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
} as const;

export function DashboardTopMetrics({ metrics }: { metrics: DashboardMetric[] }) {
  return (
    <section className="grid h-full grid-cols-2 gap-2 xl:grid-cols-5">
      {metrics.map((metric) => (
        <article
          key={metric.title}
          className="flex min-w-0 flex-col items-start justify-between gap-2 rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] px-3 py-3 shadow-[var(--panel-shadow)] sm:flex-row sm:items-center sm:px-4"
        >
          <div className="min-w-0">
            <p className="truncate text-xs text-[color:var(--text-muted)]">{metric.title}</p>
            <div className="mt-1 flex items-end gap-1.5">
              <span className="text-xl font-semibold text-[color:var(--text-primary)] sm:text-2xl">{metric.value}</span>
              {metric.unit ? <span className="pb-0.5 text-xs text-[color:var(--text-muted)]">{metric.unit}</span> : null}
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] ${toneClassMap[metric.tone]}`}
          >
            {metric.trendLabel}
          </span>
        </article>
      ))}
    </section>
  );
}
