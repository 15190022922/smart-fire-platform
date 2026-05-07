import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Tooltip({
  label,
  className,
  children,
}: HTMLAttributes<HTMLSpanElement> & {
  label: string;
}) {
  return (
    <span className={cn("group relative inline-flex", className)}>
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-[10px] border border-[color:var(--border)] bg-[var(--panel-menu-bg)] px-2.5 py-1.5 text-xs text-[color:var(--text-secondary)] shadow-[var(--panel-shadow)] group-hover:block">
        {label}
      </span>
    </span>
  );
}
