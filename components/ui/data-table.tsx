import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function DataTableShell({
  className,
  children,
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("sf-table-shell overflow-x-auto", className)}>{children}</div>;
}

export function DataTable({
  className,
  children,
}: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn("min-w-full text-left text-sm", className)}>{children}</table>;
}

export function DataTableHead({
  className,
  children,
}: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("sf-table-head", className)}>{children}</thead>;
}

export function DataTableRow({
  className,
  stripedIndex,
  children,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { stripedIndex?: number }) {
  return (
    <tr
      className={cn(
        "border-t border-[color:var(--border-soft)] text-[color:var(--text-secondary)] transition-colors duration-150 hover:bg-[color:var(--surface-muted)]",
        className,
      )}
      style={
        typeof stripedIndex === "number"
          ? { backgroundColor: stripedIndex % 2 === 0 ? "var(--table-row)" : "var(--table-row-alt)" }
          : undefined
      }
      {...props}
    >
      {children}
    </tr>
  );
}

export function DataTableHeaderCell({
  className,
  children,
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cn("px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.08em]", className)}>
      {children}
    </th>
  );
}

export function DataTableCell({
  className,
  children,
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3.5", className)}>{children}</td>;
}
