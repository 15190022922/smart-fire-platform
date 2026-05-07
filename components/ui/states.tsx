import { cn } from "@/lib/cn";

export function EmptyState({
  title = "暂无数据",
  description,
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("sf-metric-block px-4 py-6 text-center", className)}>
      <p className="text-sm font-semibold text-[color:var(--text-primary)]">{title}</p>
      {description ? <p className="mt-2 text-xs text-[color:var(--text-muted)]">{description}</p> : null}
    </div>
  );
}

export function LoadingState({
  label = "正在加载...",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("sf-metric-block flex items-center gap-3 px-4 py-3 text-sm text-[color:var(--text-secondary)]", className)}>
      <span className="h-2 w-2 rounded-full bg-[var(--accent)] sf-pulse-dot" />
      {label}
    </div>
  );
}
