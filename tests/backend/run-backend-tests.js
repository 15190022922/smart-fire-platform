const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  startBackendHarness,
  apiFetch,
  cleanupIntegrationArtifacts,
  ensureTestDevice,
  readRows,
  closePool,
} = require("./helpers.js");
const { resolveRequestContext } = require("../../apps/backend/.dist/apps/backend/src/modules/auth/auth-context.js");
const { AUTH_COOKIE_NAME } = require("../../apps/backend/.dist/packages/shared/src/auth.js");
const {
  migrateDatabase,
  seedDatabase,
} = require("../../apps/backend/.dist/apps/backend/src/lib/db-maintenance.js");
const {
  adminRepository,
  authRepository,
  historyRepository,
  platformRepository,
  simulatorRepository,
  tenantAlarmRepository,
  tenantDeviceRepository,
  tenantDevicePointRepository,
  tenantDutyRepository,
  tenantDrawingRepository,
  tenantInspectionRepository,
  tenantNotificationRepository,
  tenantOverviewRepository,
  tenantUserRepository,
  tenantSceneRepository,
} = require("../../apps/backend/.dist/packages/database/src/ops-repositories.js");
const { hashPassword } = require("../../apps/backend/.dist/lib/password.js");
const { alarmWorkflowStatuses } = require("../../apps/backend/.dist/packages/shared/src/contracts.js");

const WORKFLOW_COMPLETED = alarmWorkflowStatuses[3];
const projectRoot = path.resolve(__dirname, "..", "..");

function encodeSession(session) {
  return Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
}
const ISSUE_REVIEWED = "宸插鏌?";

async function runCase(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

async function main() {
  await cleanupIntegrationArtifacts();
  const harness = await startBackendHarness();

  try {
    await runCase("lib/db is reduced to bootstrap and deprecated wrappers", async () => {
      const dbSource = fs.readFileSync(path.join(projectRoot, "lib", "db.ts"), "utf8");
      assert.equal(dbSource.includes("CREATE TABLE IF NOT EXISTS"), false);
      assert.equal(dbSource.includes("INSERT INTO tenants"), false);
      assert.equal(dbSource.includes("new Pool("), false);
      assert.equal(dbSource.includes("@deprecated"), true);
    });

    await runCase("database scripts run successfully", async () => {
      const migrateSource = fs.readFileSync(path.join(projectRoot, "scripts", "db", "migrate.ts"), "utf8");
      const seedSource = fs.readFileSync(path.join(projectRoot, "scripts", "db", "seed.ts"), "utf8");
      const resetSource = fs.readFileSync(path.join(projectRoot, "scripts", "db", "reset.ts"), "utf8");
      assert.equal(migrateSource.includes("migrateDatabase"), true);
      assert.equal(seedSource.includes("seedDatabase"), true);
      assert.equal(resetSource.includes("resetDatabase"), true);

      await migrateDatabase();
      await seedDatabase();
    });

    await runCase("compat routes only proxy backend for migrated modules", async () => {
      const compatRoutes = [
        "app/api/admin/state/route.ts",
        "app/api/admin/tenants/route.ts",
        "app/api/platform/overview/route.ts",
        "app/api/platform/tenant-scene/route.ts",
        "app/api/platform/tenants/route.ts",
        "app/api/tenant/alarm-center/route.ts",
        "app/api/tenant/alarms/route.ts",
        "app/api/tenant/audit-log/route.ts",
        "app/api/tenant/device-points/route.ts",
        "app/api/tenant/devices/route.ts",
        "app/api/tenant/drawings/route.ts",
        "app/api/tenant/duty-center/route.ts",
        "app/api/tenant/inspection/route.ts",
        "app/api/tenant/notification-center/route.ts",
        "app/api/tenant/overview/route.ts",
        "app/api/tenant/realtime-events/route.ts",
        "app/api/tenant/spatial-model/route.ts",
        "app/api/tenant/system-health/route.ts",
        "app/api/tenant/users/route.ts",
      ];

      for (const relativePath of compatRoutes) {
        const source = fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
        assert.equal(/proxyBackend(Json|Stream)/.test(source), true, `${relativePath} should proxy backend`);
        assert.equal(source.includes("packages/database"), false, `${relativePath} should not import repositories`);
        assert.equal(source.includes("lib/db"), false, `${relativePath} should not import lib/db`);
      }
    });

    await runCase("production mode rejects forged header context", async () => {
      const previousNodeEnv = process.env.NODE_ENV;
      const previousToken = process.env.BACKEND_INTERNAL_TOKEN;
      const previousAllow = process.env.BACKEND_ALLOW_HEADER_CONTEXT;

      process.env.NODE_ENV = "production";
      delete process.env.BACKEND_INTERNAL_TOKEN;
      delete process.env.BACKEND_ALLOW_HEADER_CONTEXT;

      const context = resolveRequestContext({
        headers: {
          "x-user-scope": "platform",
          "x-tenant-id": "tenant-huaxing",
          "x-user-name": encodeURIComponent("spoofed"),
          "x-user-role": "platform_super_admin",
        },
      });

      assert.equal(context.scope, null);
      assert.equal(context.tenantId, null);
      assert.equal(context.userRole, null);

      process.env.NODE_ENV = previousNodeEnv;
      if (previousToken === undefined) {
        delete process.env.BACKEND_INTERNAL_TOKEN;
      } else {
        process.env.BACKEND_INTERNAL_TOKEN = previousToken;
      }
      if (previousAllow === undefined) {
        delete process.env.BACKEND_ALLOW_HEADER_CONTEXT;
      } else {
        process.env.BACKEND_ALLOW_HEADER_CONTEXT = previousAllow;
      }
    });

    await runCase("development mode allows explicit mock header context", async () => {
      const previousNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      delete process.env.BACKEND_ALLOW_HEADER_CONTEXT;

      const context = resolveRequestContext({
        headers: {
          "x-user-scope": "tenant",
          "x-tenant-id": "tenant-huaxing",
          "x-user-name": encodeURIComponent("dev_tester"),
          "x-user-role": "tenant_level_1",
        },
      });

      assert.equal(context.scope, "tenant");
      assert.equal(context.tenantId, "tenant-huaxing");
      assert.equal(context.userRole, "tenant_level_1");
      process.env.NODE_ENV = previousNodeEnv;
    });

    await runCase("trusted internal token works in production but cookie session still wins", async () => {
      const previousNodeEnv = process.env.NODE_ENV;
      const previousToken = process.env.BACKEND_INTERNAL_TOKEN;

      process.env.NODE_ENV = "production";
      process.env.BACKEND_INTERNAL_TOKEN = "itest-internal-token";

      const platformContext = resolveRequestContext({
        headers: {
          "x-backend-internal-token": "itest-internal-token",
          "x-user-scope": "platform",
          "x-tenant-id": "tenant-huaxing",
          "x-user-name": encodeURIComponent("internal_gateway"),
          "x-user-role": "platform_super_admin",
        },
      });
      assert.equal(platformContext.scope, "platform");

      const tenantCookie = encodeSession({
        userId: "tenant-user-1",
        username: "hx_admin",
        displayName: "华星制造管理员",
        scope: "tenant",
        roleKey: "tenant_level_1",
        tenantId: "tenant-huaxing",
      });

      const mixedContext = resolveRequestContext({
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${tenantCookie}`,
          "x-backend-internal-token": "itest-internal-token",
          "x-user-scope": "platform",
          "x-tenant-id": "tenant-anhe",
          "x-user-name": encodeURIComponent("spoofed_platform"),
          "x-user-role": "platform_super_admin",
        },
      });

      assert.equal(mixedContext.scope, "tenant");
      assert.equal(mixedContext.tenantId, "tenant-huaxing");
      assert.equal(mixedContext.userRole, "tenant_level_1");

      process.env.NODE_ENV = previousNodeEnv;
      if (previousToken === undefined) {
        delete process.env.BACKEND_INTERNAL_TOKEN;
      } else {
        process.env.BACKEND_INTERNAL_TOKEN = previousToken;
      }
    });

    await runCase("devices and users APIs work through backend", async () => {
      const deviceId = "itest-device-crud";
      const userName = "itest_user_crud";

      const createDeviceResponse = await apiFetch(harness.baseUrl, "/api/tenant/devices", {
        tenantId: "tenant-huaxing",
        method: "POST",
        body: JSON.stringify({
          id: deviceId,
          name: "itest-device-crud",
          type: "烟感探测器",
          area: "测试区域",
          installationLocation: "测试点位",
          status: "正常",
          lastReportAt: "",
          notes: "integration",
        }),
      });
      assert.equal(createDeviceResponse.status, 200);

      const listDevices = await apiFetch(harness.baseUrl, "/api/tenant/devices", { tenantId: "tenant-huaxing" });
      const devicesPayload = await listDevices.json();
      assert.ok(devicesPayload.devices.some((item) => item.id === deviceId));

      const createUserResponse = await apiFetch(harness.baseUrl, "/api/tenant/users", {
        tenantId: "tenant-huaxing",
        method: "POST",
        body: JSON.stringify({
          id: "itest-user-crud",
          username: userName,
          phone: "13900000001",
          roleKey: "tenant_level_2",
          status: "启用",
          smsEnabled: true,
          messageTypes: ["报警信息"],
          note: "integration",
        }),
      });
      assert.equal(createUserResponse.status, 200);

      const usersPayload = await (await apiFetch(harness.baseUrl, "/api/tenant/users", { tenantId: "tenant-huaxing" })).json();
      assert.ok(usersPayload.users.some((item) => item.username === userName));
    });

    await runCase("repositories enforce tenant isolation for devices and users", async () => {
      await ensureTestDevice({ tenantId: "tenant-huaxing", deviceId: "itest-device-tenant-a", name: "itest-device-tenant-a" });
      await ensureTestDevice({ tenantId: "tenant-anhe", deviceId: "itest-device-tenant-b", name: "itest-device-tenant-b" });

      await tenantUserRepository.upsert("tenant-huaxing", {
        id: "itest-user-tenant-a",
        username: "itest_user_tenant_a",
        phone: "13900000011",
        roleKey: "tenant_level_2",
        status: "鍚敤",
        smsEnabled: false,
        messageTypes: [],
        note: "repository-test",
      });
      await tenantUserRepository.upsert("tenant-anhe", {
        id: "itest-user-tenant-b",
        username: "itest_user_tenant_b",
        phone: "13900000012",
        roleKey: "tenant_level_2",
        status: "鍚敤",
        smsEnabled: false,
        messageTypes: [],
        note: "repository-test",
      });

      const huaxingDevices = await tenantDeviceRepository.list("tenant-huaxing");
      const anheDevices = await tenantDeviceRepository.list("tenant-anhe");
      const huaxingUsers = await tenantUserRepository.list("tenant-huaxing");
      const anheUsers = await tenantUserRepository.list("tenant-anhe");

      assert.ok(huaxingDevices.some((item) => item.id === "itest-device-tenant-a"));
      assert.ok(!huaxingDevices.some((item) => item.id === "itest-device-tenant-b"));
      assert.ok(anheDevices.some((item) => item.id === "itest-device-tenant-b"));
      assert.ok(!anheDevices.some((item) => item.id === "itest-device-tenant-a"));

      assert.ok(huaxingUsers.some((item) => item.id === "itest-user-tenant-a"));
      assert.ok(!huaxingUsers.some((item) => item.id === "itest-user-tenant-b"));
      assert.ok(anheUsers.some((item) => item.id === "itest-user-tenant-b"));
      assert.ok(!anheUsers.some((item) => item.id === "itest-user-tenant-a"));
    });

    await runCase("overview and spatial repositories enforce tenant isolation", async () => {
      const huaxingOverview = await tenantOverviewRepository.getOverview("tenant-huaxing");
      const anheOverview = await tenantOverviewRepository.getOverview("tenant-anhe");
      const huaxingSpatial = await tenantOverviewRepository.getSpatialModel("tenant-huaxing");
      const anheSpatial = await tenantOverviewRepository.getSpatialModel("tenant-anhe");

      assert.equal(huaxingOverview.tenant?.id, "tenant-huaxing");
      assert.equal(anheOverview.tenant?.id, "tenant-anhe");
      assert.ok(huaxingOverview.devices.every((item) => item.tenantId === "tenant-huaxing"));
      assert.ok(anheOverview.devices.every((item) => item.tenantId === "tenant-anhe"));
      assert.ok(!huaxingOverview.devices.some((item) => item.id === "itest-device-tenant-b"));
      assert.ok(!anheOverview.devices.some((item) => item.id === "itest-device-tenant-a"));

      assert.ok(huaxingSpatial.sites.every((item) => item.tenantId === "tenant-huaxing"));
      assert.ok(huaxingSpatial.drawings.every((item) => item.tenantId === "tenant-huaxing"));
      assert.ok(huaxingSpatial.devicePoints.every((item) => item.tenantId === "tenant-huaxing"));
      assert.ok(anheSpatial.sites.every((item) => item.tenantId === "tenant-anhe"));
      assert.ok(anheSpatial.drawings.every((item) => item.tenantId === "tenant-anhe"));
      assert.ok(anheSpatial.devicePoints.every((item) => item.tenantId === "tenant-anhe"));
      assert.ok(!huaxingSpatial.drawings.some((item) => item.id === "drawing-ah-main-1"));
      assert.ok(!huaxingSpatial.devicePoints.some((item) => item.id === "point-ah-1"));
    });

    await runCase("platform and tenant-scene repositories work and stay scoped", async () => {
      const platformOverview = await platformRepository.getPlatformOverviewData();
      assert.ok(platformOverview.tenants.some((item) => item.id === "tenant-huaxing"));
      assert.ok(platformOverview.tenants.some((item) => item.id === "tenant-anhe"));

      const scene = await tenantSceneRepository.getPlatformTenantScene("tenant-huaxing");
      assert.ok(scene);
      assert.equal(scene.tenant.id, "tenant-huaxing");
      assert.ok(scene.devices.every((item) => item.tenantId === "tenant-huaxing"));
      assert.ok(scene.spatialModel.drawings.every((item) => item.tenantId === "tenant-huaxing"));

      const missingScene = await tenantSceneRepository.getPlatformTenantScene("tenant-missing");
      assert.equal(missingScene, null);
    });

    await runCase("simulator, auth and history repositories work without lib/db helpers", async () => {
      const simulatorBootstrap = await simulatorRepository.getSimulatorBootstrapData();
      assert.ok(simulatorBootstrap.tenants.length >= 2);

      const simulatorScene = await simulatorRepository.getSimulatorScene("tenant-anhe");
      assert.ok(simulatorScene);
      assert.equal(simulatorScene.tenant.id, "tenant-anhe");

      const platformAccount = await authRepository.findLoginAccountByCredentials("platform_admin", "Admin123456");
      const tenantAccount = await authRepository.findLoginAccountByCredentials("hx_admin", "Hx123456");
      assert.equal(platformAccount?.scope, "platform");
      assert.equal(tenantAccount?.tenantId, "tenant-huaxing");

      const history = await historyRepository.getTenantHistoryData("tenant-huaxing");
      assert.ok(history.devices.every((item) => item.tenantId === "tenant-huaxing"));
      assert.ok(history.rawEvents.every((item) => item.tenantId === "tenant-huaxing"));
    });

    await runCase("admin repository supports tenant create update delete", async () => {
      const created = await adminRepository.createTenantWithAdminRecord({
        tenant: {
          name: "itest-platform-tenant",
          code: "ITEST-TENANT-CODE",
          industry: "test",
          contactName: "itest",
          contactPhone: "13900000031",
          status: "启用",
          note: "itest",
        },
        admin: {
          username: "itest_admin_platform",
          displayName: "itest admin",
          phone: "13900000032",
          passwordHash: hashPassword("Pass123456"),
          roleKey: "tenant_level_1",
          note: "itest",
        },
      });
      assert.equal(created.tenant.code, "ITEST-TENANT-CODE");

      const updated = await adminRepository.updateTenantRecord({
        id: created.tenant.id,
        name: "itest-platform-tenant-updated",
        code: "ITEST-TENANT-CODE",
        industry: "test-updated",
        contactName: "itest-updated",
        contactPhone: "13900000033",
        status: "启用",
        note: "itest-updated",
      });
      assert.equal(updated?.name, "itest-platform-tenant-updated");

      const adminState = await adminRepository.getAdminStateData();
      assert.ok(adminState.tenants.some((item) => item.id === created.tenant.id));

      await adminRepository.deleteTenantCascadeRecord(created.tenant.id);
      const deletedTenant = await adminRepository.getTenantById(created.tenant.id);
      assert.equal(deletedTenant, null);
    });

    await runCase("platform endpoints and tenant history enforce scope boundaries", async () => {
      const platformSceneResponse = await apiFetch(harness.baseUrl, "/api/platform/tenant-scene?tenantId=tenant-huaxing", {
        tenantId: "tenant-huaxing",
        scope: "platform",
        role: "platform_super_admin",
      });
      assert.equal(platformSceneResponse.status, 200);
      const platformScene = await platformSceneResponse.json();
      assert.equal(platformScene.tenant.id, "tenant-huaxing");

      const tenantForbiddenScene = await apiFetch(harness.baseUrl, "/api/platform/tenant-scene?tenantId=tenant-huaxing", {
        tenantId: "tenant-huaxing",
        scope: "tenant",
        role: "tenant_level_1",
      });
      assert.equal(tenantForbiddenScene.status, 403);

      const tenantHistoryResponse = await apiFetch(harness.baseUrl, "/api/tenant/history", {
        tenantId: "tenant-anhe",
        scope: "tenant",
        role: "tenant_level_1",
      });
      assert.equal(tenantHistoryResponse.status, 200);
      const tenantHistory = await tenantHistoryResponse.json();
      assert.ok(tenantHistory.devices.every((item) => item.tenantId === "tenant-anhe"));
      assert.ok(tenantHistory.rawEvents.every((item) => item.tenantId === "tenant-anhe"));
    });

    await runCase("database client no longer depends on lib/db", async () => {
      const fs = require("node:fs");
      const path = require("node:path");
      const clientSource = fs.readFileSync(path.join(process.cwd(), "packages/database/src/client.ts"), "utf8");
      assert.equal(clientSource.includes("lib/db"), false);
    });

    await runCase("overview and spatial backend endpoints return tenant-scoped data", async () => {
      const overviewResponse = await apiFetch(harness.baseUrl, "/api/tenant/overview", { tenantId: "tenant-huaxing" });
      const overviewPayload = await overviewResponse.json();
      assert.equal(overviewResponse.status, 200);
      assert.equal(overviewPayload.tenant?.id, "tenant-huaxing");
      assert.ok(Array.isArray(overviewPayload.devices));
      assert.ok(Array.isArray(overviewPayload.alarms));

      const spatialResponse = await apiFetch(harness.baseUrl, "/api/tenant/spatial-model", { tenantId: "tenant-huaxing" });
      const spatialPayload = await spatialResponse.json();
      assert.equal(spatialResponse.status, 200);
      assert.ok(Array.isArray(spatialPayload.drawings));
      assert.ok(Array.isArray(spatialPayload.devicePoints));
      assert.ok(spatialPayload.drawings.every((item) => item.tenantId === "tenant-huaxing"));
    });

    await runCase("drawings and device-points repositories support tenant-scoped CRUD", async () => {
      await ensureTestDevice({ tenantId: "tenant-huaxing", deviceId: "itest-device-point-crud", name: "itest-device-point-crud" });

      const createdDrawing = await tenantDrawingRepository.create("tenant-huaxing", {
        floorId: "floor-hx-a-1",
        name: "itest-drawing-crud",
        fileUrl: "/drawings/itest-drawing-crud.png",
        width: 1280,
        height: 720,
        version: "v2.0",
        operatorName: "itest_operator",
        operatorRole: "tenant_level_1",
      });
      assert.equal(createdDrawing.tenantId, "tenant-huaxing");

      const createdPoint = await tenantDevicePointRepository.upsert("tenant-huaxing", {
        deviceId: "itest-device-point-crud",
        floorId: "floor-hx-a-1",
        drawingId: createdDrawing.id,
        x: 0.42,
        y: 0.36,
        icon: "sensor",
        operatorName: "itest_operator",
        operatorRole: "tenant_level_1",
      });
      assert.equal(createdPoint.tenantId, "tenant-huaxing");

      const drawings = await tenantDrawingRepository.list("tenant-huaxing");
      const points = await tenantDevicePointRepository.list("tenant-huaxing");
      assert.ok(drawings.some((item) => item.id === createdDrawing.id));
      assert.ok(points.some((item) => item.id === createdPoint.id));
      assert.ok(!(await tenantDrawingRepository.list("tenant-anhe")).some((item) => item.id === createdDrawing.id));
      assert.ok(!(await tenantDevicePointRepository.list("tenant-anhe")).some((item) => item.id === createdPoint.id));
    });

    await runCase("drawings and device-points backend endpoints return tenant-scoped data", async () => {
      const drawingsResponse = await apiFetch(harness.baseUrl, "/api/tenant/drawings", { tenantId: "tenant-huaxing" });
      const drawingsPayload = await drawingsResponse.json();
      assert.equal(drawingsResponse.status, 200);
      assert.ok(Array.isArray(drawingsPayload.drawings));
      assert.ok(drawingsPayload.drawings.every((item) => item.tenantId === "tenant-huaxing"));

      const pointsResponse = await apiFetch(harness.baseUrl, "/api/tenant/device-points", { tenantId: "tenant-huaxing" });
      const pointsPayload = await pointsResponse.json();
      assert.equal(pointsResponse.status, 200);
      assert.ok(Array.isArray(pointsPayload.points));
      assert.ok(pointsPayload.points.every((item) => item.tenantId === "tenant-huaxing"));
    });

    await runCase("deleting a drawing cascades device-point deletion transactionally", async () => {
      const deviceId = "itest-device-point-cascade";
      await ensureTestDevice({ tenantId: "tenant-huaxing", deviceId, name: "itest-device-point-cascade" });

      const drawing = await tenantDrawingRepository.create("tenant-huaxing", {
        floorId: "floor-hx-a-1",
        name: "itest-drawing-cascade",
        fileUrl: "/drawings/itest-drawing-cascade.png",
        width: 1600,
        height: 900,
        version: "v1.1",
        operatorName: "itest_operator",
        operatorRole: "tenant_level_1",
      });
      const point = await tenantDevicePointRepository.upsert("tenant-huaxing", {
        deviceId,
        floorId: "floor-hx-a-1",
        drawingId: drawing.id,
        x: 0.3,
        y: 0.4,
        icon: "sensor",
        operatorName: "itest_operator",
        operatorRole: "tenant_level_1",
      });

      const result = await tenantDrawingRepository.remove("tenant-huaxing", drawing.id, {
        operatorName: "itest_operator",
        operatorRole: "tenant_level_1",
      });
      assert.equal(result.success, true);
      assert.equal(result.deletedPointCount, 1);

      const drawingRows = await readRows("SELECT id FROM tenant_drawings WHERE tenant_id = $1 AND id = $2", ["tenant-huaxing", drawing.id]);
      const pointRows = await readRows("SELECT id FROM tenant_device_points WHERE tenant_id = $1 AND id = $2", ["tenant-huaxing", point.id]);
      const auditRows = await readRows(
        "SELECT action, detail FROM audit_logs WHERE tenant_id = $1 AND target_id = $2 ORDER BY created_at DESC",
        ["tenant-huaxing", drawing.id],
      );
      assert.equal(drawingRows.length, 0);
      assert.equal(pointRows.length, 0);
      assert.ok(auditRows.some((item) => item.action === "drawing.delete"));
    });

    await runCase("ingestion chain creates one alarm and suppresses duplicates", async () => {
      const deviceId = "itest-device-alarm";
      await ensureTestDevice({ tenantId: "tenant-huaxing", deviceId, name: "itest-device-alarm" });

      const realtimeResponse = await apiFetch(harness.baseUrl, "/api/tenant/realtime-events", {
        tenantId: "tenant-huaxing",
        headers: { Accept: "text/event-stream" },
      });
      assert.equal(realtimeResponse.status, 200);
      const reader = realtimeResponse.body.getReader();
      try {
        let realtimeBuffer = "";
        const realtimePromise = (async () => {
          const deadline = Date.now() + 5000;
          while (Date.now() < deadline) {
            const { value, done } = await reader.read();
            if (done) break;
            realtimeBuffer += Buffer.from(value).toString("utf8");
            if (realtimeBuffer.includes('"type":"alarm_created"')) {
              return true;
            }
          }
          return false;
        })();

        const alarmEvent = {
          event_id: "itest-event-1",
          tenant_id: "tenant-huaxing",
          device_id: deviceId,
          event_type: "alarm",
          event_value: { smoke: 92 },
          event_time: new Date().toISOString(),
        };

      const firstResponse = await apiFetch(harness.baseUrl, "/api/ingestion/event", {
        tenantId: "tenant-huaxing",
        scope: "platform",
        role: "platform_super_admin",
        method: "POST",
        body: JSON.stringify(alarmEvent),
      });
        assert.equal(firstResponse.status, 200);

      const duplicateResponse = await apiFetch(harness.baseUrl, "/api/ingestion/event", {
        tenantId: "tenant-huaxing",
        scope: "platform",
        role: "platform_super_admin",
        method: "POST",
        body: JSON.stringify(alarmEvent),
      });
        assert.equal(duplicateResponse.status, 200);
        const duplicatePayload = await duplicateResponse.json();
        assert.equal(duplicatePayload.workflow.duplicate_suppressed, true);

        const alarmRows = await readRows(
          "SELECT id FROM tenant_alarms WHERE tenant_id = $1 AND device_id = $2",
          ["tenant-huaxing", deviceId],
        );
        assert.equal(alarmRows.length, 1);

        const notificationRows = await readRows(
          "SELECT id FROM notification_records WHERE tenant_id = $1 AND device_id = $2",
          ["tenant-huaxing", deviceId],
        );
        assert.ok(notificationRows.length >= 1);

        const auditRows = await readRows(
          "SELECT action FROM audit_logs WHERE tenant_id = $1 AND target_id = $2 ORDER BY created_at DESC",
          ["tenant-huaxing", deviceId],
        );
        assert.ok(auditRows.some((item) => item.action === "device.event.ingested"));

        const otherTenantAlarms = await (await apiFetch(harness.baseUrl, "/api/tenant/alarm-center", { tenantId: "tenant-anhe" })).json();
        assert.ok(otherTenantAlarms.alarms.every((item) => item.deviceId !== deviceId));

      const recoveryResponse = await apiFetch(harness.baseUrl, "/api/ingestion/event", {
        tenantId: "tenant-huaxing",
        scope: "platform",
        role: "platform_super_admin",
        method: "POST",
        body: JSON.stringify({
            event_id: "itest-event-2",
            tenant_id: "tenant-huaxing",
            device_id: deviceId,
            event_type: "recovery",
            event_value: { restored: true },
            event_time: new Date().toISOString(),
          }),
        });
        assert.equal(recoveryResponse.status, 200);

        const workflowRows = await readRows(
          "SELECT workflow_status FROM tenant_alarms WHERE tenant_id = $1 AND device_id = $2",
          ["tenant-huaxing", deviceId],
        );
        assert.equal(workflowRows.length, 1);
        assert.notEqual(workflowRows[0].workflow_status, "已关闭");
        assert.notEqual(workflowRows[0].workflow_status, "已完成");

        const gotRealtime = await realtimePromise;
        assert.equal(gotRealtime, true);
      } finally {
        await reader.cancel().catch(() => undefined);
      }
    });

    await runCase("ingestion rolls back when device does not exist", async () => {
      const missingEventId = "itest-event-missing-device";
      const response = await apiFetch(harness.baseUrl, "/api/ingestion/event", {
        tenantId: "tenant-huaxing",
        scope: "platform",
        role: "platform_super_admin",
        method: "POST",
        body: JSON.stringify({
          event_id: missingEventId,
          tenant_id: "tenant-huaxing",
          device_id: "itest-device-missing",
          event_type: "alarm",
          event_value: { smoke: 77 },
          event_time: new Date().toISOString(),
        }),
      });
      assert.equal(response.status, 404);

      const rawRows = await readRows("SELECT id FROM raw_device_events WHERE event_id = $1", [missingEventId]);
      const alarmRows = await readRows("SELECT id FROM tenant_alarms WHERE device_id = $1", ["itest-device-missing"]);
      assert.equal(rawRows.length, 0);
      assert.equal(alarmRows.length, 0);
    });

    await runCase("alarm workflow transition updates logs and device state transactionally", async () => {
      const deviceId = "itest-device-workflow";
      await ensureTestDevice({ tenantId: "tenant-huaxing", deviceId, name: "itest-device-workflow" });

      const ingestResponse = await apiFetch(harness.baseUrl, "/api/ingestion/event", {
        tenantId: "tenant-huaxing",
        scope: "platform",
        role: "platform_super_admin",
        method: "POST",
        body: JSON.stringify({
          event_id: "itest-event-workflow-1",
          tenant_id: "tenant-huaxing",
          device_id: deviceId,
          event_type: "alarm",
          event_value: { smoke: 88 },
          event_time: new Date().toISOString(),
        }),
      });
      assert.equal(ingestResponse.status, 200);

      const alarms = await tenantAlarmRepository.list("tenant-huaxing");
      const targetAlarm = alarms.find((item) => item.deviceId === deviceId);
      assert.ok(targetAlarm);

      const patchResponse = await apiFetch(harness.baseUrl, "/api/tenant/alarm-center", {
        tenantId: "tenant-huaxing",
        method: "PATCH",
        body: JSON.stringify({
          alarmId: targetAlarm.id,
          nextStatus: WORKFLOW_COMPLETED,
          note: "itest workflow complete",
        }),
      });
      assert.equal(patchResponse.status, 200);

      const alarmRows = await readRows("SELECT workflow_status FROM tenant_alarms WHERE id = $1", [targetAlarm.id]);
      const alarmLogs = await readRows("SELECT id FROM alarm_logs WHERE alarm_id = $1", [targetAlarm.id]);
      const deviceRows = await readRows("SELECT status FROM tenant_devices WHERE id = $1 AND tenant_id = $2", [deviceId, "tenant-huaxing"]);
      assert.ok(alarmRows.length === 1);
      assert.ok(alarmLogs.length >= 2);
      assert.ok(deviceRows.length === 1);
    });

    await runCase("notification retry endpoint works for failed records", async () => {
      const deviceId = "itest-device-notify-fail";
      await ensureTestDevice({
        tenantId: "tenant-huaxing",
        deviceId,
        name: "[FORCE_NOTIFY_FAIL] itest-device-notify-fail",
      });

      const ingestResponse = await apiFetch(harness.baseUrl, "/api/ingestion/event", {
        tenantId: "tenant-huaxing",
        scope: "platform",
        role: "platform_super_admin",
        method: "POST",
        body: JSON.stringify({
          event_id: "itest-event-notify-fail",
          tenant_id: "tenant-huaxing",
          device_id: deviceId,
          event_type: "alarm",
          event_value: { smoke: 99 },
          event_time: new Date().toISOString(),
        }),
      });
      assert.equal(ingestResponse.status, 200);

      const failedRows = await readRows(
        "SELECT id, status FROM notification_records WHERE tenant_id = $1 AND device_id = $2 ORDER BY created_at DESC",
        ["tenant-huaxing", deviceId],
      );
      const failedRecord = failedRows.find((item) => item.status === "failed");
      assert.ok(failedRecord);

      const retryResponse = await apiFetch(harness.baseUrl, "/api/tenant/notification-center", {
        tenantId: "tenant-huaxing",
        method: "PATCH",
        body: JSON.stringify({ recordId: failedRecord.id }),
      });
      assert.equal(retryResponse.status, 200);

      const retriedRows = await readRows(
        "SELECT status, retry_count FROM notification_records WHERE id = $1",
        [failedRecord.id],
      );
      assert.equal(retriedRows[0].status, "sent");
      assert.equal(retriedRows[0].retry_count, 1);

      const centerData = await tenantNotificationRepository.getCenterData("tenant-huaxing");
      assert.ok(centerData.records.some((item) => item.id === failedRecord.id && item.status === "sent"));
    });

    await runCase("duty-center and inspection endpoints are backend-driven", async () => {
      const dutyCreateResponse = await apiFetch(harness.baseUrl, "/api/tenant/duty-center", {
        tenantId: "tenant-huaxing",
        method: "POST",
        body: JSON.stringify({
          dutyDate: "2026-04-24",
          shiftId: "shift-hx-morning",
          assigneeName: "itest-duty-user",
          assigneePhone: "13900000002",
        }),
      });
      assert.equal(dutyCreateResponse.status, 200);
      const dutyPayload = await dutyCreateResponse.json();
      const schedule = dutyPayload.schedules.find((item) => item.assigneeName === "itest-duty-user");
      assert.ok(schedule);

      const handoverResponse = await apiFetch(harness.baseUrl, "/api/tenant/duty-center", {
        tenantId: "tenant-huaxing",
        method: "PATCH",
        body: JSON.stringify({
          scheduleId: schedule.id,
          note: "itest handover",
        }),
      });
      assert.equal(handoverResponse.status, 200);

      const inspectionCreateResponse = await apiFetch(harness.baseUrl, "/api/tenant/inspection", {
        tenantId: "tenant-huaxing",
        method: "POST",
        body: JSON.stringify({
          action: "create-task",
          title: "itest-inspection-task",
          planType: "daily",
          targetType: "device",
          targetId: "device-hx-1",
          targetName: "device-hx-1",
          dueDate: "2026-04-24",
          assignedTo: "hx_admin",
          note: "integration",
        }),
      });
      assert.equal(inspectionCreateResponse.status, 200);
      const inspectionPayload = await inspectionCreateResponse.json();
      const task = inspectionPayload.tasks.find((item) => item.title === "itest-inspection-task");
      assert.ok(task);

      const abnormalResponse = await apiFetch(harness.baseUrl, "/api/tenant/inspection", {
        tenantId: "tenant-huaxing",
        method: "POST",
        body: JSON.stringify({
          action: "submit-record",
          taskId: task.id,
          result: "abnormal",
          note: "itest abnormal",
        }),
      });
      assert.equal(abnormalResponse.status, 200);
      const abnormalPayload = await abnormalResponse.json();
      const issue = abnormalPayload.issues.find((item) => item.sourceId === task.id);
      assert.ok(issue);

      const reviewResponse = await apiFetch(harness.baseUrl, "/api/tenant/inspection", {
        tenantId: "tenant-huaxing",
        method: "PATCH",
        body: JSON.stringify({
          issueId: issue.id,
          status: "已复查",
          note: "itest closed",
        }),
      });
      assert.equal(reviewResponse.status, 200);
    });

    await runCase("duty and inspection repositories work without lib/db helpers", async () => {
      await tenantDutyRepository.createSchedule("tenant-huaxing", {
        dutyDate: "2026-04-25",
        shiftId: "shift-hx-evening",
        assigneeName: "itest-duty-repository",
        assigneePhone: "13900000021",
        assignedBy: "itest_dispatcher",
      });
      const dutyCenter = await tenantDutyRepository.getCenterData("tenant-huaxing");
      const schedule = dutyCenter.schedules.find((item) => item.assigneeName === "itest-duty-repository");
      assert.ok(schedule);

      await tenantInspectionRepository.createTask("tenant-huaxing", {
        title: "itest-repository-inspection",
        planType: "weekly",
        targetType: "area",
        targetId: "itest-area-1",
        targetName: "itest-area-1",
        dueDate: "2026-04-25",
        assignedTo: "hx_admin",
        note: "repository-direct",
        operatorName: "itest_manager",
      });
      const inspectionCenter = await tenantInspectionRepository.getCenterData("tenant-huaxing");
      const task = inspectionCenter.tasks.find((item) => item.title === "itest-repository-inspection");
      assert.ok(task);

      await tenantInspectionRepository.submitRecord("tenant-huaxing", {
        taskId: task.id,
        result: "abnormal",
        note: "repository abnormal",
        inspectedBy: "itest_inspector",
      });
      const abnormalCenter = await tenantInspectionRepository.getCenterData("tenant-huaxing");
      const issue = abnormalCenter.issues.find((item) => item.sourceId === task.id);
      assert.ok(issue);

      await tenantInspectionRepository.updateIssue("tenant-huaxing", {
        issueId: issue.id,
        status: ISSUE_REVIEWED,
        note: "repository reviewed",
        operatorName: "itest_manager",
      });
      const finalCenter = await tenantInspectionRepository.getCenterData("tenant-huaxing");
      const finalIssue = finalCenter.issues.find((item) => item.id === issue.id);
      assert.ok(finalIssue);
    });

    console.log("PASS backend integration suite");
  } finally {
    await cleanupIntegrationArtifacts();
    await harness.close();
    await closePool();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
