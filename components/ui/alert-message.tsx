import { cn } from "@/lib/cn";

type AlertTone = "info" | "success" | "warning" | "danger";

const toneClassMap: Record<AlertTone, string> = {
  info: "border-[color:var(--border-soft)] bg-[var(--info-soft)] text-[var(--accent-strong)]",
  success: "border-[color:var(--border-soft)] bg-[var(--success-soft)] text-[var(--success-strong)]",
  warning: "border-[color:var(--border-soft)] bg-[var(--warning-soft)] text-[var(--warning-strong)]",
  danger: "border-[color:var(--border-soft)] bg-[var(--danger-soft)] text-[var(--danger-strong)]",
};

export function AlertMessage({
  tone = "info",
  className,
  children,
}: {
  tone?: AlertTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-[var(--radius-card)] border px-4 py-3 text-sm shadow-[var(--panel-inset)]", toneClassMap[tone], className)}>
      {children}
    </div>
  );
}
