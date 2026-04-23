"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { getTenantEventBus } from "@/lib/realtime/event-bus";
import type { SystemHealthPayload } from "@/types/ops";
import type { RealtimeConnectionState } from "@/types/realtime";

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
    <div className="space-y-4">
      <PageHeader
        title="系统健康"
        subtitle="监控实时连接、报警延迟、设备在线率、错误日志和接口响应时间，判断值守链路是否健康。"
        aside={
          <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[color:var(--text-secondary)]">
            <p>实时连接</p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">
              {realtimeStatus === "connected" ? "已连接" : realtimeStatus === "reconnecting" ? "重连中" : "连接中"}
            </p>
          </div>
        }
      />

      <SectionCard title="关键指标" description="按照安全关键系统视角展示核心运行指标。">
        <div className="grid gap-3 lg:grid-cols-5">
          {data.metrics.map((metric) => (
            <div key={metric.code} className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3">
              <p className="text-xs text-[color:var(--text-muted)]">{metric.name}</p>
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
              <div key={item.id} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-rose-700">{item.action}</p>
                  <span className="text-xs text-rose-600">{item.createdAt}</span>
                </div>
                <p className="mt-1 text-xs text-rose-700">
                  {item.actorName} / {item.targetType} / {item.targetId}
                </p>
                <p className="mt-2 text-sm text-rose-700">{item.detail}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="最近设备事件" description="按最近接入顺序展示原始事件流。">
          <div className="space-y-3">
            {data.latestEvents.map((event) => (
              <div key={event.id} className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[color:var(--text-primary)]">{event.deviceId}</p>
                  <span className="text-xs text-[color:var(--text-muted)]">{event.reportedAt}</span>
                </div>
                <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                  {event.eventType} / {event.eventCode}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
