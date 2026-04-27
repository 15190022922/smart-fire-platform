"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBackendServer = createBackendServer;
const http_1 = require("http");
const load_env_1 = require("./lib/load-env");
const http_2 = require("./lib/http");
const runtime_metrics_1 = require("./lib/runtime-metrics");
const admin_controller_1 = require("./modules/admin/admin-controller");
const alarm_controller_1 = require("./modules/alarm/alarm-controller");
const audit_controller_1 = require("./modules/audit/audit-controller");
const auth_controller_1 = require("./modules/auth/auth-controller");
const auth_context_1 = require("./modules/auth/auth-context");
const device_controller_1 = require("./modules/devices/device-controller");
const duty_controller_1 = require("./modules/duty/duty-controller");
const health_controller_1 = require("./modules/health/health-controller");
const history_controller_1 = require("./modules/history/history-controller");
const inspection_controller_1 = require("./modules/inspection/inspection-controller");
const ingestion_controller_1 = require("./modules/ingestion/ingestion-controller");
const notification_controller_1 = require("./modules/notification/notification-controller");
const platform_controller_1 = require("./modules/platform/platform-controller");
const realtime_controller_1 = require("./modules/realtime/realtime-controller");
const spatial_controller_1 = require("./modules/spatial/spatial-controller");
const user_controller_1 = require("./modules/users/user-controller");
(0, load_env_1.loadBackendEnv)();
const port = Number(process.env.BACKEND_PORT ?? 4001);
function createBackendServer() {
    return (0, http_1.createServer)(async (req, res) => {
        if (!req.url || !req.method) {
            (0, http_2.sendJson)(res, 400, { message: "无效请求" });
            return;
        }
        if (req.method === "OPTIONS") {
            res.statusCode = 204;
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Headers", "Content-Type, Cookie, x-tenant-id, x-user-scope, x-user-name, x-user-role, x-backend-internal-token");
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
            if (req.method === "GET" && url.pathname === "/api/platform/overview") {
                await (0, platform_controller_1.getPlatformOverview)(res, context);
                return;
            }
            if (req.method === "GET" && url.pathname === "/api/platform/tenants") {
                await (0, platform_controller_1.getPlatformTenants)(res, context);
                return;
            }
            if (req.method === "GET" && url.pathname === "/api/platform/tenant-scene") {
                await (0, platform_controller_1.getPlatformTenantScene)(url, res, context);
                return;
            }
            if (req.method === "GET" && url.pathname === "/api/admin/state") {
                await (0, admin_controller_1.getAdminState)(res, context);
                return;
            }
            if (req.method === "PUT" && url.pathname === "/api/admin/state") {
                await (0, admin_controller_1.putAdminState)(req, res, context);
                return;
            }
            if (req.method === "POST" && url.pathname === "/api/admin/tenants") {
                await (0, admin_controller_1.postAdminTenant)(req, res, context);
                return;
            }
            if (req.method === "PUT" && url.pathname === "/api/admin/tenants") {
                await (0, admin_controller_1.putAdminTenant)(req, res, context);
                return;
            }
            if (req.method === "DELETE" && url.pathname === "/api/admin/tenants") {
                await (0, admin_controller_1.deleteAdminTenant)(url, res, context);
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
            if (req.method === "PATCH" && url.pathname === "/api/tenant/notification-center") {
                await (0, notification_controller_1.patchNotificationCenter)(req, res, context);
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
                await (0, spatial_controller_1.getTenantOverview)(res, context);
                return;
            }
            if (req.method === "GET" && url.pathname === "/api/tenant/spatial-model") {
                await (0, spatial_controller_1.getTenantSpatialModel)(res, context);
                return;
            }
            if (req.method === "GET" && url.pathname === "/api/tenant/history") {
                await (0, history_controller_1.getTenantHistory)(res, context);
                return;
            }
            if (req.method === "GET" && url.pathname === "/api/tenant/drawings") {
                await (0, spatial_controller_1.getTenantDrawings)(res, context);
                return;
            }
            if (req.method === "POST" && url.pathname === "/api/tenant/drawings") {
                await (0, spatial_controller_1.postTenantDrawing)(req, res, context);
                return;
            }
            if (req.method === "DELETE" && url.pathname === "/api/tenant/drawings") {
                await (0, spatial_controller_1.deleteTenantDrawing)(url, res, context);
                return;
            }
            if (req.method === "GET" && url.pathname === "/api/tenant/device-points") {
                await (0, spatial_controller_1.getTenantDevicePoints)(res, context);
                return;
            }
            if (req.method === "POST" && url.pathname === "/api/tenant/device-points") {
                await (0, spatial_controller_1.postTenantDevicePoint)(req, res, context);
                return;
            }
            if (req.method === "DELETE" && url.pathname === "/api/tenant/device-points") {
                await (0, spatial_controller_1.deleteTenantDevicePoint)(url, res, context);
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
            if (req.method === "GET" && url.pathname === "/api/tenant/users") {
                await (0, user_controller_1.getUsers)(res, context);
                return;
            }
            if (req.method === "POST" && url.pathname === "/api/tenant/users") {
                await (0, user_controller_1.postUser)(req, res, context);
                return;
            }
            if (req.method === "DELETE" && url.pathname === "/api/tenant/users") {
                await (0, user_controller_1.deleteUser)(url, res, context);
                return;
            }
            if (req.method === "GET" && url.pathname === "/api/tenant/duty-center") {
                await (0, duty_controller_1.getDutyCenter)(res, context);
                return;
            }
            if (req.method === "POST" && url.pathname === "/api/tenant/duty-center") {
                await (0, duty_controller_1.postDutySchedule)(req, res, context);
                return;
            }
            if (req.method === "PATCH" && url.pathname === "/api/tenant/duty-center") {
                await (0, duty_controller_1.patchDutyCenter)(req, res, context);
                return;
            }
            if (req.method === "GET" && url.pathname === "/api/tenant/inspection") {
                await (0, inspection_controller_1.getInspectionCenter)(res, context);
                return;
            }
            if (req.method === "POST" && url.pathname === "/api/tenant/inspection") {
                await (0, inspection_controller_1.postInspection)(req, res, context);
                return;
            }
            if (req.method === "PATCH" && url.pathname === "/api/tenant/inspection") {
                await (0, inspection_controller_1.patchInspection)(req, res, context);
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
            (0, runtime_metrics_1.recordRuntimeError)("backend_server", error instanceof Error ? error.message : String(error));
            (0, http_2.sendJson)(res, 500, { message: "后端服务内部错误" });
        }
    });
}
if (require.main === module) {
    const server = createBackendServer();
    server.listen(port, () => {
        console.log(`[backend] listening on http://localhost:${port}`);
    });
}
