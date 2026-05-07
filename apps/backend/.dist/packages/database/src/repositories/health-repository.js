"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTenantSystemHealth = getTenantSystemHealth;
const client_1 = require("../client");
const errors_1 = require("../errors");
const _shared_1 = require("./_shared");
async function getTenantSystemHealth(tenantId) {
    (0, errors_1.assertTenantId)(tenantId);
    const now = new Date();
    const [devices, events, audits] = await Promise.all([
        (0, client_1.queryDb)("SELECT * FROM tenant_devices WHERE tenant_id = $1 AND COALESCE(lifecycle_status, 'active') = 'active'", [tenantId]),
        (0, client_1.queryDb)("SELECT * FROM raw_device_events WHERE tenant_id = $1 ORDER BY reported_at DESC LIMIT 20", [tenantId]),
        (0, client_1.queryDb)("SELECT * FROM audit_logs WHERE tenant_id = $1 AND result = 'error' ORDER BY created_at DESC LIMIT 20", [tenantId]),
    ]);
    const totalDevices = devices.rows.length || 1;
    const onlineDevices = devices.rows.filter((row) => (0, _shared_1.normalizeStatusText)(row.status) !== "离线").length;
    const onlineRate = (onlineDevices / totalDevices) * 100;
    const latestAlarmEvent = events.rows.find((row) => String(row.event_type) === "alarm") ?? events.rows[0];
    const latestEventDate = latestAlarmEvent ? (0, _shared_1.parseDbDate)(latestAlarmEvent.reported_at) : null;
    const delaySeconds = latestEventDate ? Math.max(0, Math.round((now.getTime() - latestEventDate.getTime()) / 1000)) : 0;
    return (0, _shared_1.buildSystemHealthPayload)({
        generatedAt: (0, _shared_1.formatLocalTimestamp)(),
        metrics: [
            (0, _shared_1.buildSystemHealthMetric)({
                code: "realtime_link",
                name: "实时连接状态",
                value: delaySeconds <= 10 ? 1 : delaySeconds <= 30 ? 0.5 : 0,
                displayValue: delaySeconds <= 10 ? "稳定" : delaySeconds <= 30 ? "波动" : "异常",
                unit: "",
                level: delaySeconds <= 10 ? "normal" : delaySeconds <= 30 ? "warning" : "critical",
                detail: "按最近事件到达延迟估算实时链路状态。",
            }),
            (0, _shared_1.buildSystemHealthMetric)({
                code: "alarm_delay",
                name: "最近报警延迟",
                value: delaySeconds,
                displayValue: String(delaySeconds),
                unit: "秒",
                level: delaySeconds <= 5 ? "normal" : delaySeconds <= 15 ? "warning" : "critical",
                detail: "按最近原始事件时间与当前系统时间计算。",
            }),
            (0, _shared_1.buildSystemHealthMetric)({
                code: "device_online_rate",
                name: "设备在线率",
                value: Number(onlineRate.toFixed(1)),
                displayValue: onlineRate.toFixed(1),
                unit: "%",
                level: onlineRate >= 95 ? "normal" : onlineRate >= 85 ? "warning" : "critical",
                detail: "按企业当前非离线设备占比计算。",
            }),
            (0, _shared_1.buildSystemHealthMetric)({
                code: "error_log_count",
                name: "错误日志数量",
                value: audits.rows.length,
                displayValue: String(audits.rows.length),
                unit: "条",
                level: audits.rows.length === 0 ? "normal" : audits.rows.length <= 5 ? "warning" : "critical",
                detail: "统计最近错误审计日志数量。",
            }),
            (0, _shared_1.buildSystemHealthMetric)({
                code: "api_response_time",
                name: "接口响应时间",
                value: 0,
                displayValue: "前端测量",
                unit: "ms",
                level: "normal",
                detail: "由前端页面请求时测量，不使用静态库值。",
            }),
        ],
        recentErrors: audits.rows.map(_shared_1.mapAuditLog),
        latestEvents: events.rows.map((row) => ({
            id: row.id,
            deviceId: row.device_id,
            eventType: row.event_type,
            eventCode: row.event_code,
            reportedAt: row.reported_at,
        })),
    });
}
