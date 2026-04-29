"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { getTenantEventBus } from "@/lib/realtime/event-bus";
import type { AuditLogRecord } from "@/types/ops";

const PAGE_SIZE = 12;

export function AuditLogBoard({ logs }: { logs: AuditLogRecord[] }) {
  const [items, setItems] = useState(Array.isArray(logs) ? logs : []);
  const [keyword, setKeyword] = useState("");
  const [resultFilter, setResultFilter] = useState<"all" | "success" | "error">("all");
  const [page, setPage] = useState(1);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/tenant/audit-log", { cache: "no-store" });
    if (!response.ok) return;
    const payload = (await response.json()) as { logs?: AuditLogRecord[] };
    setItems(Array.isArray(payload.logs) ? payload.logs : []);
  }, []);

  useEffect(() => {
    const bus = getTenantEventBus();
    return bus.subscribe({
      types: ["alarm_created", "alarm_updated", "device_status_changed", "system_alert"],
      onEvent: () => {
        void refresh();
      },
    });
  }, [refresh]);

  const filtered = useMemo(() => {
    return items.filter((log) => {
      if (resultFilter !== "all" && log.result !== resultFilter) return false;
      if (!keyword.trim()) return true;
      const text = `${log.actorName} ${log.action} ${log.targetType} ${log.detail}`.toLowerCase();
      return text.includes(keyword.trim().toLowerCase());
    });
  }, [items, keyword, resultFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const visibleLogs = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  return (
    <div className="space-y-2.5">
      <PageHeader
        title="审计日志"
        subtitle="记录登录、报警处理、设备操作、权限变更等关键行为，满足追溯和责任界定要求。"
      />

      <SectionCard title="检索条件" description="按结果和关键字筛选关键操作日志。">
        <div className="sf-toolbar grid gap-3 p-3 md:grid-cols-[180px_minmax(0,1fr)]">
          <select
            value={resultFilter}
            onChange={(event) => {
              setResultFilter(event.target.value as "all" | "success" | "error");
              setPage(1);
            }}
            className="sf-input h-10 px-3 text-sm"
          >
            <option value="all">全部结果</option>
            <option value="success">成功</option>
            <option value="error">失败</option>
          </select>
          <input
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(1);
            }}
            placeholder="按操作人、动作、目标类型、详情搜索"
            className="sf-input h-10 px-3 text-sm"
          />
        </div>
      </SectionCard>

      <SectionCard title="审计记录" description="最近 500 条关键操作。">
        <div className="sf-table-shell overflow-x-auto">
          <table className="min-w-[820px] text-left text-sm">
            <thead className="sf-table-head">
              <tr>
                <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.08em]">时间</th>
                <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.08em]">操作人</th>
                <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.08em]">动作</th>
                <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.08em]">目标</th>
                <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.08em]">结果</th>
                <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.08em]">详情</th>
              </tr>
            </thead>
            <tbody>
              {visibleLogs.map((log) => (
                <tr key={log.id} className="border-t border-[color:var(--border-soft)] bg-[var(--table-row)] transition-colors duration-150 hover:bg-[color:var(--surface-muted)]">
                  <td className="px-4 py-3">{log.createdAt}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[color:var(--text-primary)]">{log.actorName}</div>
                    <div className="text-xs text-[color:var(--text-muted)]">
                      {log.actorScope} / {log.actorRole}
                    </div>
                  </td>
                  <td className="px-4 py-3">{auditActionLabel(log.action)}</td>
                  <td className="px-4 py-3">
                    {auditTargetLabel(log.targetType)} / {log.targetId}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs ${
                        log.result === "success"
                          ? "border-[color:var(--success)] bg-[var(--success-soft)] text-[color:var(--success-strong)]"
                          : "border-[color:var(--danger)] bg-[var(--danger-soft)] text-[color:var(--danger-strong)]"
                      }`}
                    >
                      {log.result === "success" ? "成功" : "失败"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[color:var(--text-secondary)]">{auditDetailLabel(log.detail)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationBar
          page={safePage}
          totalPages={totalPages}
          totalItems={filtered.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          label="审计日志"
        />
      </SectionCard>
    </div>
  );
}

function auditActionLabel(action: string) {
  const labels: Record<string, string> = {
    "inspection.record.submit": "提交巡检记录",
    "issue.status.update": "更新隐患状态",
    "alarm.workflow.update": "警情流程更新",
    "alarm.quick_status.update": "警情状态更新",
    "device.upsert": "保存设备",
    "device.delete": "删除设备",
    "drawing.create": "上传图纸",
    "drawing.delete": "删除图纸",
    "device_point.upsert": "保存点位",
    "device_point.delete": "删除点位",
  };
  return labels[action] ?? action;
}

function auditTargetLabel(targetType: string) {
  const labels: Record<string, string> = {
    inspection_task: "巡检任务",
    issue: "隐患",
    alarm: "警情",
    device: "设备",
    drawing: "图纸",
    device_point: "设备点位",
  };
  return labels[targetType] ?? targetType;
}

function auditDetailLabel(detail: string) {
  return detail
    .replaceAll("result=completed", "结果=已完成")
    .replaceAll("result=abnormal", "结果=异常")
    .replaceAll("status=pending", "状态=待处理")
    .replaceAll("status=in_progress", "状态=处理中")
    .replaceAll("status=completed", "状态=已完成")
    .replaceAll("status=closed", "状态=已关闭")
    .replaceAll("process_status ->", "处理状态 ->");
}
