"use client";

import { ActionButton } from "@/components/ui/action-button";

type PaginationBarProps = {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  label?: string;
};

export function PaginationBar({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  label = "列表",
}: PaginationBarProps) {
  if (totalItems <= pageSize || totalPages <= 1) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-[color:var(--border)] pt-3 text-sm text-[color:var(--text-secondary)] sm:flex-row sm:items-center sm:justify-between">
      <p>
        {label}共 {totalItems} 条，当前第 {page} / {totalPages} 页
      </p>
      <div className="flex items-center gap-2">
        <ActionButton
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          size="xs"
          className="disabled:cursor-not-allowed disabled:opacity-40"
        >
          上一页
        </ActionButton>
        <ActionButton
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          size="xs"
          className="disabled:cursor-not-allowed disabled:opacity-40"
        >
          下一页
        </ActionButton>
      </div>
    </div>
  );
}
