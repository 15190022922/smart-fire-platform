import { DashboardMetric } from "@/types/platform";

const toneClassMap = {
  danger: "border-[color:var(--border-soft)] bg-[var(--danger-soft)] text-[var(--danger-strong)]",
  warning: "border-[color:var(--border-soft)] bg-[var(--warning-soft)] text-[var(--warning-strong)]",
  success: "border-[color:var(--border-soft)] bg-[var(--success-soft)] text-[var(--success-strong)]",
  info: "border-[color:var(--border-soft)] bg-[var(--info-soft)] text-[var(--accent-strong)]",
} as const;

export function DashboardTopMetrics({
  metrics,
  variant = "row",
}: {
  metrics: DashboardMetric[];
  variant?: "row" | "side";
}) {
  const isSide = variant === "side";
  const layoutClass =
    isSide
      ? "grid h-full min-h-0 auto-rows-fr grid-cols-1 gap-1.5"
      : "sf-toolbar grid h-full grid-cols-2 overflow-hidden rounded-[16px] p-0 xl:grid-cols-5";
  const valueClass = isSide ? "text-[1.15rem]" : "text-[1.55rem]";
  const itemClass =
    isSide
      ? "relative flex min-w-0 items-center justify-between gap-2 overflow-hidden rounded-[12px] border border-[color:var(--panel-divider)] bg-[var(--panel-cell-bg)] px-3 py-2 shadow-[var(--panel-inset)] backdrop-blur-xl"
      : "relative flex min-w-0 items-center justify-between gap-3 border-b border-r border-[color:var(--panel-divider)] bg-[var(--panel-cell-bg)] px-3 py-2.5 last:border-r-0 xl:border-b-0";

  return (
    <section className={layoutClass}>
      {metrics.map((metric) => (
        <article
          key={metric.title}
          className={itemClass}
        >
          <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--glass-highlight),transparent)]" />
          <div className={isSide ? "min-w-0" : "flex min-w-0 flex-1 items-baseline gap-2"}>
            <p className={isSide ? "truncate text-[10px] font-medium uppercase tracking-[0.08em] text-[color:var(--text-muted)]" : "min-w-0 truncate text-[12px] font-semibold tracking-[-0.01em] text-[color:var(--text-secondary)]"}>
              {metric.title}
            </p>
            <div className={isSide ? "mt-0.5 flex items-end gap-1.5" : "flex shrink-0 items-end gap-1.5"}>
              <span className={`${valueClass} font-semibold leading-none tracking-[-0.02em] text-[color:var(--text-primary)]`}>
                {metric.value}
              </span>
              {metric.unit ? <span className="pb-0.5 text-[11px] text-[color:var(--text-muted)]">{metric.unit}</span> : null}
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-[0.04em] ${isSide ? "" : "hidden 2xl:inline-flex"} ${toneClassMap[metric.tone]}`}
          >
            {metric.trendLabel}
          </span>
        </article>
      ))}
    </section>
  );
}
