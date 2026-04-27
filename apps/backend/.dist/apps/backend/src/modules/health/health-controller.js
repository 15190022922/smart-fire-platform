"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSystemHealth = getSystemHealth;
exports.getBackendHealth = getBackendHealth;
const tenant_repositories_1 = require("../../../../../packages/database/src/tenant-repositories");
const http_1 = require("../../lib/http");
const auth_controller_1 = require("../auth/auth-controller");
const runtime_metrics_1 = require("../../lib/runtime-metrics");
const server_1 = require("../../../../../packages/realtime/src/server");
const client_1 = require("../../../../../packages/database/src/client");
async function getSystemHealth(res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const payload = await tenant_repositories_1.tenantHealthRepository.getPayload(context.tenantId);
    const runtime = (0, runtime_metrics_1.getRuntimeMetricsSnapshot)();
    const realtime = (0, server_1.getRealtimeServerStats)();
    const dbStatus = await (0, client_1.queryDb)("SELECT 1")
        .then(() => "connected")
        .catch(() => "disconnected");
    const metrics = [
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
            level: runtime.avgAlarmGenerationMs <= 100 ? "normal" : runtime.avgAlarmGenerationMs <= 500 ? "warning" : "critical",
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
    (0, http_1.sendJson)(res, 200, {
        ...payload,
        metrics,
        recentErrors: [
            ...runtime.recentErrors.map((item, index) => ({
                id: `runtime-${index}`,
                tenantId: context.tenantId ?? "",
                actorScope: "platform",
                actorName: "backend_runtime",
                actorRole: item.source,
                action: item.source,
                targetType: "runtime",
                targetId: item.source,
                result: "error",
                detail: item.message,
                createdAt: item.createdAt,
            })),
            ...payload.recentErrors,
        ].slice(0, 20),
    });
}
async function getBackendHealth(res) {
    (0, http_1.sendJson)(res, 200, {
        service: "backend",
        status: "ok",
        time: new Date().toISOString(),
    });
}
