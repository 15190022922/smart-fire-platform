import { DashboardMetric } from "@/types/platform";

const toneClassMap = {
  danger: "border-[rgba(176,72,79,0.18)] bg-[var(--danger-soft)] text-[var(--danger-strong)]",
  warning: "border-[rgba(169,107,34,0.18)] bg-[var(--warning-soft)] text-[var(--warning-strong)]",
  success: "border-[rgba(57,118,91,0.16)] bg-[var(--success-soft)] text-[var(--success-strong)]",
  info: "border-[rgba(72,106,141,0.18)] bg-[var(--info-soft)] text-[var(--accent-strong)]",
} as const;

export function DashboardTopMetrics({ metrics }: { metrics: DashboardMetric[] }) {
  return (
    <section className="grid h-full grid-cols-2 gap-1.5 xl:grid-cols-5">
      {metrics.map((metric) => (
        <article
          key={metric.title}
          className="relative flex min-w-0 flex-col items-start justify-between gap-2 overflow-hidden rounded-[16px] border border-[color:var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(246,249,253,0.98)_100%)] px-3 py-2.5 shadow-[var(--panel-shadow)] sm:flex-row sm:items-center sm:px-4"
        >
          <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(72,106,141,0.18),transparent)]" />
          <div className="min-w-0">
            <p className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
              {metric.title}
            </p>
            <div className="mt-1.5 flex items-end gap-1.5">
              <span className="text-[1.35rem] font-semibold tracking-[-0.03em] text-[color:var(--text-primary)] sm:text-[1.7rem]">
                {metric.value}
              </span>
              {metric.unit ? <span className="pb-1 text-[11px] text-[color:var(--text-muted)]">{metric.unit}</span> : null}
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.04em] ${toneClassMap[metric.tone]}`}
          >
            {metric.trendLabel}
          </span>
        </article>
      ))}
    </section>
  );
}
