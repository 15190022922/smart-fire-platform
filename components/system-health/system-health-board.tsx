"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { getTenantEventBus } from "@/lib/realtime/event-bus";
import type { SystemHealthPayload } from "@/types/ops";
import type { RealtimeConnectionState } from "@/types/realtime";

const EVENT_PAGE_SIZE = 6;

export function SystemHealthBoard({ initialData }: { initialData: SystemHealthPayload }) {
  const safeInitialData: SystemHealthPayload = {
    generatedAt: initialData?.generatedAt ?? "",
    metrics: Array.isArray(initialData?.metrics) ? initialData.metrics : [],
    recentErrors: Array.isArray(initialData?.recentErrors) ? initialData.recentErrors : [],
    latestEvents: Array.isArray(initialData?.latestEvents) ? initialData.latestEvents : [],
  };
  const [data, setData] = useState(safeInitialData);
  const [apiLatency, setApiLatency] = useState<number | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeConnectionState>("connecting");
  const [eventPage, setEventPage] = useState(1);

  const eventTotalPages = Math.max(1, Math.ceil(data.latestEvents.length / EVENT_PAGE_SIZE));
  const safeEventPage = Math.min(eventPage, eventTotalPages);
  const pagedEvents = data.latestEvents.slice((safeEventPage - 1) * EVENT_PAGE_SIZE, safeEventPage * EVENT_PAGE_SIZE);

  useEffect(() => {
    let mounted = true;

    async function refresh() {
      const startedAt = performance.now();
      const response = await fetch("/api/tenant/system-health", { cache: "no-store" });
      const endedAt = performance.now();
      if (!response.ok || !mounted) return;
      const payload = (await response.json()) as Partial<SystemHealthPayload>;
      setData({
        generatedAt: typeof payload.generatedAt === "string" ? payload.generatedAt : "",
        metrics: Array.isArray(payload.metrics) ? payload.metrics : [],
        recentErrors: Array.isArray(payload.recentErrors) ? payload.recentErrors : [],
        latestEvents: Array.isArray(payload.latestEvents) ? payload.latestEvents : [],
      });
      setApiLatency(Math.round(endedAt - startedAt));
      setEventPage(1);
    }

    const bus = getTenantEventBus();
    const unsubscribe = bus.subscribe({
      types: ["alarm_created", "alarm_updated", "device_status_changed", "system_alert"],
      onEvent: () => void refresh(),
      onState: (state) => setRealtimeStatus(state),
    });

    void refresh();
    const timer = window.setInterval(() => void refresh(), 60000);

    return () => {
      mounted = false;
      unsubscribe();
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="space-y-2.5">
      <PageHeader
        title="系统健康"
        subtitle="监控实时连接、报警延迟、设备在线率、错误日志和接口响应时间，判断值守链路是否健康。"
        aside={
          <div className="sf-metric-block px-3.5 py-2.5 text-sm text-[color:var(--text-secondary)]">
            <p className="sf-label">实时连接</p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">
              {realtimeStatus === "connected" ? "已连接" : realtimeStatus === "reconnecting" ? "重连中" : "连接中"}
            </p>
          </div>
        }
      />

      <SectionCard title="关键指标" description="按照安全关键系统视角展示核心运行指标。">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {data.metrics.map((metric) => (
            <div key={metric.code} className="sf-kpi px-4 py-3">
              <p className="sf-label">{metric.name}</p>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">
                {metric.displayValue}
                {metric.code === "api_response_time" && apiLatency !== null ? apiLatency : metric.unit ? metric.unit : ""}
              </p>
              <p className="mt-2 text-xs text-[color:var(--text-secondary)]">{metric.detail}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <SectionCard title="最近错误日志" description="最近失败操作，用于快速定位风险。">
          <div className="space-y-3">
            {data.recentErrors.map((item) => (
              <div key={item.id} className="rounded-[var(--radius-card)] border border-[color:var(--danger)] bg-[var(--danger-soft)] px-4 py-3 shadow-[var(--panel-inset)]">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[color:var(--danger-strong)]">{item.action}</p>
                  <span className="text-xs text-[color:var(--danger-strong)]">{item.createdAt}</span>
                </div>
                <p className="mt-1 text-xs text-[color:var(--danger-strong)]">
                  {item.actorName} / {item.targetType} / {item.targetId}
                </p>
                <p className="mt-2 text-sm text-[color:var(--danger-strong)]">{item.detail}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="最近设备事件" description="按最近接入顺序展示原始事件流。">
          <div className="sf-table-shell overflow-x-auto">
            <table className="min-w-full text-left text-sm text-[color:var(--text-secondary)]">
              <thead className="sf-table-head text-xs uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">设备</th>
                  <th className="px-4 py-3 font-medium">事件类型</th>
                  <th className="px-4 py-3 font-medium">事件编码</th>
                  <th className="px-4 py-3 font-medium">上报时间</th>
                </tr>
              </thead>
              <tbody>
                {pagedEvents.map((event, index) => (
                  <tr
                    key={event.id}
                    className="border-t border-[color:var(--border-soft)] transition-colors duration-150 hover:bg-[color:var(--surface-muted)]"
                    style={{ backgroundColor: index % 2 === 0 ? "var(--table-row)" : "var(--table-row-alt)" }}
                  >
                    <td className="px-4 py-3 font-semibold text-[color:var(--text-primary)]">{event.deviceId}</td>
                    <td className="px-4 py-3">{eventTypeLabel(event.eventType)}</td>
                    <td className="px-4 py-3">{event.eventCode}</td>
                    <td className="px-4 py-3 text-[color:var(--text-muted)]">{event.reportedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={safeEventPage}
            totalPages={eventTotalPages}
            totalItems={data.latestEvents.length}
            pageSize={EVENT_PAGE_SIZE}
            onPageChange={setEventPage}
            label="设备事件"
          />
        </SectionCard>
      </div>
    </div>
  );
}

function eventTypeLabel(type: string) {
  if (type === "alarm") return "报警";
  if (type === "fault") return "故障";
  if (type === "recover") return "恢复";
  if (type === "heartbeat") return "心跳";
  if (type === "status_change") return "状态变更";
  if (type === "alarm_workflow_updated") return "警情流转";
  if (type === "alarm_status_changed") return "警情状态";
  return type;
}
