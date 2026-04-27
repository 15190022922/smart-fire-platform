import { createServer } from "http";
import { loadBackendEnv } from "./lib/load-env";
import { sendJson } from "./lib/http";
import { recordRuntimeError } from "./lib/runtime-metrics";
import {
  deleteAdminTenant,
  getAdminState,
  postAdminTenant,
  putAdminState,
  putAdminTenant,
} from "./modules/admin/admin-controller";
import { getAlarmCenter, patchAlarmCenter } from "./modules/alarm/alarm-controller";
import { getAuditLogs } from "./modules/audit/audit-controller";
import { getAuthSessionHandler } from "./modules/auth/auth-controller";
import { resolveRequestContext } from "./modules/auth/auth-context";
import { getDevices, postDevice, deleteDevice } from "./modules/devices/device-controller";
import { getDutyCenter, patchDutyCenter, postDutySchedule } from "./modules/duty/duty-controller";
import { getSystemHealth, getBackendHealth } from "./modules/health/health-controller";
import { getTenantHistory } from "./modules/history/history-controller";
import { getInspectionCenter, patchInspection, postInspection } from "./modules/inspection/inspection-controller";
import { postIngestionEvent } from "./modules/ingestion/ingestion-controller";
import { getNotificationCenter, patchNotificationCenter } from "./modules/notification/notification-controller";
import { getPlatformOverview, getPlatformTenantScene, getPlatformTenants } from "./modules/platform/platform-controller";
import { openRealtimeStream } from "./modules/realtime/realtime-controller";
import {
  deleteTenantDevicePoint,
  deleteTenantDrawing,
  getTenantDevicePoints,
  getTenantDrawings,
  getTenantOverview,
  getTenantSpatialModel,
  postTenantDevicePoint,
  postTenantDrawing,
} from "./modules/spatial/spatial-controller";
import { getUsers, postUser, deleteUser } from "./modules/users/user-controller";

loadBackendEnv();

const port = Number(process.env.BACKEND_PORT ?? 4001);

export function createBackendServer() {
  return createServer(async (req, res) => {
    if (!req.url || !req.method) {
      sendJson(res, 400, { message: "无效请求" });
      return;
    }

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Cookie, x-tenant-id, x-user-scope, x-user-name, x-user-role, x-backend-internal-token",
      );
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const context = resolveRequestContext(req);

    try {
      if (req.method === "GET" && url.pathname === "/healthz") {
        await getBackendHealth(res);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/auth/session") {
        getAuthSessionHandler(res, context);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/platform/overview") {
        await getPlatformOverview(res, context);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/platform/tenants") {
        await getPlatformTenants(res, context);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/platform/tenant-scene") {
        await getPlatformTenantScene(url, res, context);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/admin/state") {
        await getAdminState(res, context);
        return;
      }
      if (req.method === "PUT" && url.pathname === "/api/admin/state") {
        await putAdminState(req, res, context);
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/admin/tenants") {
        await postAdminTenant(req, res, context);
        return;
      }
      if (req.method === "PUT" && url.pathname === "/api/admin/tenants") {
        await putAdminTenant(req, res, context);
        return;
      }
      if (req.method === "DELETE" && url.pathname === "/api/admin/tenants") {
        await deleteAdminTenant(url, res, context);
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/ingestion/event") {
        await postIngestionEvent(req, res, context);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/tenant/alarm-center") {
        await getAlarmCenter(res, context);
        return;
      }
      if (req.method === "PATCH" && url.pathname === "/api/tenant/alarm-center") {
        await patchAlarmCenter(req, res, context);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/tenant/notification-center") {
        await getNotificationCenter(res, context);
        return;
      }
      if (req.method === "PATCH" && url.pathname === "/api/tenant/notification-center") {
        await patchNotificationCenter(req, res, context);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/tenant/audit-log") {
        await getAuditLogs(res, context);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/tenant/system-health") {
        await getSystemHealth(res, context);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/tenant/overview") {
        await getTenantOverview(res, context);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/tenant/spatial-model") {
        await getTenantSpatialModel(res, context);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/tenant/history") {
        await getTenantHistory(res, context);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/tenant/drawings") {
        await getTenantDrawings(res, context);
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/tenant/drawings") {
        await postTenantDrawing(req, res, context);
        return;
      }
      if (req.method === "DELETE" && url.pathname === "/api/tenant/drawings") {
        await deleteTenantDrawing(url, res, context);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/tenant/device-points") {
        await getTenantDevicePoints(res, context);
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/tenant/device-points") {
        await postTenantDevicePoint(req, res, context);
        return;
      }
      if (req.method === "DELETE" && url.pathname === "/api/tenant/device-points") {
        await deleteTenantDevicePoint(url, res, context);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/tenant/devices") {
        await getDevices(res, context);
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/tenant/devices") {
        await postDevice(req, res, context);
        return;
      }
      if (req.method === "DELETE" && url.pathname === "/api/tenant/devices") {
        await deleteDevice(req, res, context, url);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/tenant/users") {
        await getUsers(res, context);
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/tenant/users") {
        await postUser(req, res, context);
        return;
      }
      if (req.method === "DELETE" && url.pathname === "/api/tenant/users") {
        await deleteUser(url, res, context);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/tenant/duty-center") {
        await getDutyCenter(res, context);
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/tenant/duty-center") {
        await postDutySchedule(req, res, context);
        return;
      }
      if (req.method === "PATCH" && url.pathname === "/api/tenant/duty-center") {
        await patchDutyCenter(req, res, context);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/tenant/inspection") {
        await getInspectionCenter(res, context);
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/tenant/inspection") {
        await postInspection(req, res, context);
        return;
      }
      if (req.method === "PATCH" && url.pathname === "/api/tenant/inspection") {
        await patchInspection(req, res, context);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/tenant/realtime-events") {
        openRealtimeStream(req, res, context);
        return;
      }

      sendJson(res, 404, { message: "接口不存在" });
    } catch (error) {
      console.error("[backend]", error);
      recordRuntimeError("backend_server", error instanceof Error ? error.message : String(error));
      sendJson(res, 500, { message: "后端服务内部错误" });
    }
  });
}

if (require.main === module) {
  const server = createBackendServer();
  server.listen(port, () => {
    console.log(`[backend] listening on http://localhost:${port}`);
  });
}
