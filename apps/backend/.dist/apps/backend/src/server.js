"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const load_env_1 = require("./lib/load-env");
const auth_controller_1 = require("./modules/auth/auth-controller");
const auth_context_1 = require("./modules/auth/auth-context");
const http_2 = require("./lib/http");
const ingestion_controller_1 = require("./modules/ingestion/ingestion-controller");
const alarm_controller_1 = require("./modules/alarm/alarm-controller");
const notification_controller_1 = require("./modules/notification/notification-controller");
const audit_controller_1 = require("./modules/audit/audit-controller");
const health_controller_1 = require("./modules/health/health-controller");
const device_controller_1 = require("./modules/devices/device-controller");
const realtime_controller_1 = require("./modules/realtime/realtime-controller");
(0, load_env_1.loadBackendEnv)();
const port = Number(process.env.BACKEND_PORT ?? 4001);
const server = (0, http_1.createServer)(async (req, res) => {
    if (!req.url || !req.method) {
        (0, http_2.sendJson)(res, 400, { message: "无效请求" });
        return;
    }
    if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Cookie, x-tenant-id, x-user-scope, x-user-name, x-user-role");
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
        res.end();
        return;
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    const context = (0, auth_context_1.resolveRequestContext)(req);
    try {
        if (req.method === "GET" && url.pathname === "/healthz") {
            await (0, health_controller_1.getBackendHealth)(res);
            return;
        }
        if (req.method === "GET" && url.pathname === "/api/auth/session") {
            (0, auth_controller_1.getAuthSessionHandler)(res, context);
            return;
        }
        if (req.method === "POST" && url.pathname === "/api/ingestion/event") {
            await (0, ingestion_controller_1.postIngestionEvent)(req, res, context);
            return;
        }
        if (req.method === "GET" && url.pathname === "/api/tenant/alarm-center") {
            await (0, alarm_controller_1.getAlarmCenter)(res, context);
            return;
        }
        if (req.method === "PATCH" && url.pathname === "/api/tenant/alarm-center") {
            await (0, alarm_controller_1.patchAlarmCenter)(req, res, context);
            return;
        }
        if (req.method === "GET" && url.pathname === "/api/tenant/notification-center") {
            await (0, notification_controller_1.getNotificationCenter)(res, context);
            return;
        }
        if (req.method === "GET" && url.pathname === "/api/tenant/audit-log") {
            await (0, audit_controller_1.getAuditLogs)(res, context);
            return;
        }
        if (req.method === "GET" && url.pathname === "/api/tenant/system-health") {
            await (0, health_controller_1.getSystemHealth)(res, context);
            return;
        }
        if (req.method === "GET" && url.pathname === "/api/tenant/overview") {
            await (0, health_controller_1.getTenantOverview)(res, context);
            return;
        }
        if (req.method === "GET" && url.pathname === "/api/tenant/spatial-model") {
            await (0, health_controller_1.getTenantSpatialModel)(res, context);
            return;
        }
        if (req.method === "GET" && url.pathname === "/api/tenant/devices") {
            await (0, device_controller_1.getDevices)(res, context);
            return;
        }
        if (req.method === "POST" && url.pathname === "/api/tenant/devices") {
            await (0, device_controller_1.postDevice)(req, res, context);
            return;
        }
        if (req.method === "DELETE" && url.pathname === "/api/tenant/devices") {
            await (0, device_controller_1.deleteDevice)(req, res, context, url);
            return;
        }
        if (req.method === "GET" && url.pathname === "/api/tenant/realtime-events") {
            (0, realtime_controller_1.openRealtimeStream)(req, res, context);
            return;
        }
        (0, http_2.sendJson)(res, 404, { message: "接口不存在" });
    }
    catch (error) {
        console.error("[backend]", error);
        (0, http_2.sendJson)(res, 500, { message: "后端服务内部错误" });
    }
});
server.listen(port, () => {
    console.log(`[backend] listening on http://localhost:${port}`);
});
