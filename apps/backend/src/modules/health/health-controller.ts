import type { ServerResponse } from "http";
import { tenantHealthRepository } from "../../../../../packages/database/src/tenant-repositories";
import { sendJson } from "../../lib/http";
import type { BackendRequestContext } from "../auth/auth-context";
import { requireTenantContext } from "../auth/auth-controller";
import { getRuntimeMetricsSnapshot } from "../../lib/runtime-metrics";
import { getRealtimeServerStats } from "../../../../../packages/realtime/src/server";
import { queryDb } from "../../../../../packages/database/src/client";
import type { SystemHealthMetric } from "../../../../../types/ops";

export async function getSystemHealth(res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const payload = await tenantHealthRepository.getPayload(context.tenantId!);
  const runtime = getRuntimeMetricsSnapshot();
  const realtime = getRealtimeServerStats();
  const dbStatus = await queryDb("SELECT 1")
    .then(() => "connected")
    .catch(() => "disconnected");

  const metrics: SystemHealthMetric[] = [
    ...payload.metrics,
    {
      code: "ingestion_tps",
      name: "Ingestion TPS",
      value: runtime.ingestionTps,
      displayValue: String(runtime.ingestionTps),
      unit: "/s",
      level: runtime.ingestionTps < 20 ? "normal" : runtime.ingestionTps < 50 ? "warning" : "critical",
      detail: "最近 60 秒接入吞吐。",
    },
    {
      code: "alarm_engine_latency",
      name: "告警生成耗时",
      value: runtime.avgAlarmGenerationMs,
      displayValue: String(runtime.avgAlarmGenerationMs),
      unit: "ms",
      level:
        runtime.avgAlarmGenerationMs <= 100 ? "normal" : runtime.avgAlarmGenerationMs <= 500 ? "warning" : "critical",
      detail: "最近 60 秒 ingestion 主链路平均耗时。",
    },
    {
      code: "notification_failures",
      name: "通知失败数",
      value: runtime.notificationFailures,
      displayValue: String(runtime.notificationFailures),
      unit: "次",
      level: runtime.notificationFailures === 0 ? "normal" : runtime.notificationFailures <= 5 ? "warning" : "critical",
      detail: "当前运行周期内通知失败累计值。",
    },
    {
      code: "realtime_connections",
      name: "实时连接数",
      value: realtime.connectionCount,
      displayValue: String(realtime.connectionCount),
      unit: "条",
      level: "normal",
      detail: "当前 SSE 实时连接数。",
    },
    {
      code: "database_status",
      name: "数据库连接状态",
      value: dbStatus === "connected" ? 1 : 0,
      displayValue: dbStatus === "connected" ? "正常" : "异常",
      unit: "",
      level: dbStatus === "connected" ? "normal" : "critical",
      detail: "后端实时探测 PostgreSQL 可用性。",
    },
  ];

  sendJson(res, 200, {
    ...payload,
    metrics,
    recentErrors: [
      ...runtime.recentErrors.map((item, index) => ({
        id: `runtime-${index}`,
        tenantId: context.tenantId ?? "",
        actorScope: "platform" as const,
        actorName: "backend_runtime",
        actorRole: item.source,
        action: item.source,
        targetType: "runtime",
        targetId: item.source,
        result: "error" as const,
        detail: item.message,
        createdAt: item.createdAt,
      })),
      ...payload.recentErrors,
    ].slice(0, 20),
  });
}

export async function getBackendHealth(res: ServerResponse) {
  sendJson(res, 200, {
    service: "backend",
    status: "ok",
    time: new Date().toISOString(),
  });
}
