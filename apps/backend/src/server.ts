import { createServer } from "http";
import { loadBackendEnv } from "./lib/load-env";
import { getAuthSessionHandler } from "./modules/auth/auth-controller";
import { resolveRequestContext } from "./modules/auth/auth-context";
import { sendJson } from "./lib/http";
import { postIngestionEvent } from "./modules/ingestion/ingestion-controller";
import { getAlarmCenter, patchAlarmCenter } from "./modules/alarm/alarm-controller";
import { getNotificationCenter } from "./modules/notification/notification-controller";
import { getAuditLogs } from "./modules/audit/audit-controller";
import { getBackendHealth, getSystemHealth, getTenantOverview, getTenantSpatialModel } from "./modules/health/health-controller";
import { getDevices, postDevice, deleteDevice } from "./modules/devices/device-controller";
import { openRealtimeStream } from "./modules/realtime/realtime-controller";

loadBackendEnv();

const port = Number(process.env.BACKEND_PORT ?? 4001);

const server = createServer(async (req, res) => {
  if (!req.url || !req.method) {
    sendJson(res, 400, { message: "无效请求" });
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

    if (req.method === "GET" && url.pathname === "/api/tenant/realtime-events") {
      openRealtimeStream(req, res, context);
      return;
    }

    sendJson(res, 404, { message: "接口不存在" });
  } catch (error) {
    console.error("[backend]", error);
    sendJson(res, 500, { message: "后端服务内部错误" });
  }
});

server.listen(port, () => {
  console.log(`[backend] listening on http://localhost:${port}`);
});
