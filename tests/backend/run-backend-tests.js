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
  tenantFloorRepository,
  tenantInspectionRepository,
  tenantNotificationRepository,
  tenantOverviewRepository,
  tenantSpatialAreaRepository,
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
const ISSUE_REVIEWED = "已复查";

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
        "app/api/admin/platform-notices/route.ts",
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
        "app/api/tenant/platform-notices/route.ts",
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
          deviceCode: deviceId,
          name: "itest-device-crud",
          type: "烟感探测器",
          area: "测试区域",
          installationLocation: "测试点位",
          status: "正常",
          installationStatus: "已安装",
          lastReportAt: "",
          notes: "integration",
          customAttributes: { alarmType: "火警" },
        }),
      });
      assert.equal(createDeviceResponse.status, 200);

      const listDevices = await apiFetch(harness.baseUrl, "/api/tenant/devices", { tenantId: "tenant-huaxing" });
      const devicesPayload = await listDevices.json();
      assert.ok(devicesPayload.devices.some((item) => item.id === deviceId));
      assert.ok(devicesPayload.devices.some((item) => item.id === deviceId && item.deviceCode === deviceId));
      const snapshotRows = await readRows(
        "SELECT status, last_reported_at FROM device_status_snapshots WHERE tenant_id = $1 AND device_id = $2",
        ["tenant-huaxing", deviceId],
      );
      assert.equal(snapshotRows.length, 1);
      assert.equal(snapshotRows[0].status, "normal");
      assert.ok(snapshotRows[0].last_reported_at);

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

    await runCase("device lifecycle disable and restore hides realtime surfaces but preserves history", async () => {
      const deviceId = "itest-device-lifecycle";
      const pointId = "itest-point-lifecycle";
      const eventId = "itest-disabled-event-1";

      const createDeviceResponse = await apiFetch(harness.baseUrl, "/api/tenant/devices", {
        tenantId: "tenant-huaxing",
        method: "POST",
        body: JSON.stringify({
          id: deviceId,
          deviceCode: deviceId,
          name: "itest-device-lifecycle",
          type: "烟感探测器",
          area: "测试区域",
          installationLocation: "测试点位",
          status: "正常",
          installationStatus: "已安装",
          lastReportAt: "",
          notes: "integration",
          customAttributes: {},
        }),
      });
      assert.equal(createDeviceResponse.status, 200);

      const drawingRows = await readRows(
        "SELECT id, building_id, floor_id FROM tenant_drawings WHERE tenant_id = $1 AND building_id <> '' AND floor_id <> '' ORDER BY updated_at DESC LIMIT 1",
        ["tenant-huaxing"],
      );
      assert.ok(drawingRows.length > 0);
      const pointResponse = await apiFetch(harness.baseUrl, "/api/tenant/device-points", {
        tenantId: "tenant-huaxing",
        method: "POST",
        body: JSON.stringify({
          id: pointId,
          deviceId,
          buildingId: drawingRows[0].building_id,
          floorId: drawingRows[0].floor_id,
          drawingId: drawingRows[0].id,
          x: 0.21,
          y: 0.34,
          icon: "smoke",
          statusStyle: "normal",
        }),
      });
      assert.equal(pointResponse.status, 200);

      const previewResponse = await apiFetch(harness.baseUrl, "/api/tenant/devices/lifecycle/preview", {
        tenantId: "tenant-huaxing",
        method: "POST",
        body: JSON.stringify({ action: "disable", deviceIds: [deviceId] }),
      });
      assert.equal(previewResponse.status, 200);
      const preview = await previewResponse.json();
      assert.equal(preview.updateable, 1);
      assert.equal(preview.pointCount, 1);

      const disableResponse = await apiFetch(harness.baseUrl, "/api/tenant/devices/lifecycle", {
        tenantId: "tenant-huaxing",
        method: "PATCH",
        body: JSON.stringify({ action: "disable", deviceIds: [deviceId], reason: "integration disable" }),
      });
      assert.equal(disableResponse.status, 200);
      const disablePayload = await disableResponse.json();
      assert.equal(disablePayload.updated, 1);

      const activeDevices = await (await apiFetch(harness.baseUrl, "/api/tenant/devices", { tenantId: "tenant-huaxing" })).json();
      const disabledDevices = await (await apiFetch(harness.baseUrl, "/api/tenant/devices?lifecycle=disabled", { tenantId: "tenant-huaxing" })).json();
      const allDevices = await (await apiFetch(harness.baseUrl, "/api/tenant/devices?lifecycle=all", { tenantId: "tenant-huaxing" })).json();
      assert.ok(!activeDevices.devices.some((item) => item.id === deviceId));
      assert.ok(disabledDevices.devices.some((item) => item.id === deviceId && item.lifecycleStatus === "disabled"));
      assert.ok(allDevices.devices.some((item) => item.id === deviceId));

      const overview = await tenantOverviewRepository.getOverview("tenant-huaxing");
      const spatial = await tenantOverviewRepository.getSpatialModel("tenant-huaxing");
      assert.ok(!overview.devices.some((item) => item.id === deviceId));
      assert.ok(!spatial.devicePoints.some((item) => item.deviceId === deviceId));

      const ingestResponse = await apiFetch(harness.baseUrl, "/api/ingestion/event", {
        tenantId: "tenant-huaxing",
        scope: "platform",
        role: "platform_super_admin",
        method: "POST",
        body: JSON.stringify({
          event_id: eventId,
          tenant_id: "tenant-huaxing",
          device_id: deviceId,
          event_type: "alarm",
          event_value: { smokeDensity: 96 },
          event_time: new Date().toISOString(),
        }),
      });
      assert.equal(ingestResponse.status, 200);
      const ingestPayload = await ingestResponse.json();
      assert.equal(ingestPayload.device_status, "ignored");
      assert.equal(ingestPayload.workflow.ignored_due_to_disabled, true);
      const ignoredRows = await readRows("SELECT processing_status, event_code FROM raw_device_events WHERE tenant_id = $1 AND device_id = $2 AND id = $3", [
        "tenant-huaxing",
        deviceId,
        ingestPayload.raw_event_id,
      ]);
      assert.equal(ignoredRows.length, 1);
      assert.equal(ignoredRows[0].processing_status, "ignored");
      assert.equal(ignoredRows[0].event_code, "DEVICE_DISABLED_IGNORED");
      const alarmRows = await readRows("SELECT id FROM tenant_alarms WHERE tenant_id = $1 AND device_id = $2", ["tenant-huaxing", deviceId]);
      assert.equal(alarmRows.length, 0);

      const restoreResponse = await apiFetch(harness.baseUrl, "/api/tenant/devices/lifecycle", {
        tenantId: "tenant-huaxing",
        method: "PATCH",
        body: JSON.stringify({ action: "restore", deviceIds: [deviceId] }),
      });
      assert.equal(restoreResponse.status, 200);
      const restorePayload = await restoreResponse.json();
      assert.equal(restorePayload.updated, 1);

      const restoredDevices = await (await apiFetch(harness.baseUrl, "/api/tenant/devices", { tenantId: "tenant-huaxing" })).json();
      const restoredSpatial = await tenantOverviewRepository.getSpatialModel("tenant-huaxing");
      assert.ok(restoredDevices.devices.some((item) => item.id === deviceId && item.lifecycleStatus === "active"));
      assert.ok(restoredSpatial.devicePoints.some((item) => item.deviceId === deviceId));
    });

    await runCase("device attributes and import APIs support configured custom fields", async () => {
      const attributesResponse = await apiFetch(harness.baseUrl, "/api/tenant/device-attributes", { tenantId: "tenant-huaxing" });
      assert.equal(attributesResponse.status, 200);
      const attributesPayload = await attributesResponse.json();
      assert.ok(attributesPayload.attributes.some((item) => item.fieldKey === "deviceCode"));

      const unknownPreviewResponse = await apiFetch(harness.baseUrl, "/api/tenant/device-import/preview", {
        tenantId: "tenant-huaxing",
        method: "POST",
        body: JSON.stringify({
          fileName: "itest.xlsx",
          headers: ["设备编码", "设备名称", "未配置字段"],
          rows: [{ rowNumber: 2, values: { 设备编码: "itest-import-unknown", 设备名称: "itest-import-unknown", 未配置字段: "x" } }],
        }),
      });
      assert.equal(unknownPreviewResponse.status, 200);
      const unknownPreviewPayload = await unknownPreviewResponse.json();
      assert.ok(unknownPreviewPayload.unknownHeaders.includes("未配置字段"));
      assert.equal(unknownPreviewPayload.importableRows, 0);

      const addAttributeResponse = await apiFetch(harness.baseUrl, "/api/tenant/device-attributes", {
        tenantId: "tenant-huaxing",
        method: "POST",
        body: JSON.stringify({ label: "itest-报警类型", fieldType: "text", required: false, showInList: true, sortOrder: 120 }),
      });
      assert.equal(addAttributeResponse.status, 200);
      const addedAttributePayload = await addAttributeResponse.json();

      const importRows = [
        {
          rowNumber: 2,
          values: {
            设备编码: "itest-import-device-1",
            设备名称: "itest-import-device-1",
            设备类型: "烟感探测器",
            "所属区域/楼层": "导入测试区",
            安装位置: "导入点位",
            "itest-报警类型": "火警",
          },
        },
      ];

      const commitResponse = await apiFetch(harness.baseUrl, "/api/tenant/device-import/commit", {
        tenantId: "tenant-huaxing",
        method: "POST",
        body: JSON.stringify({ fileName: "itest.xlsx", headers: Object.keys(importRows[0].values), rows: importRows, duplicatePolicy: "error" }),
      });
      assert.equal(commitResponse.status, 200);
      const commitPayload = await commitResponse.json();
      assert.equal(commitPayload.created, 1);

      const duplicateErrorPayload = await (
        await apiFetch(harness.baseUrl, "/api/tenant/device-import/commit", {
          tenantId: "tenant-huaxing",
          method: "POST",
          body: JSON.stringify({ fileName: "itest.xlsx", headers: Object.keys(importRows[0].values), rows: importRows, duplicatePolicy: "error" }),
        })
      ).json();
      assert.ok(duplicateErrorPayload.errors.some((item) => item.message.includes("已存在")));

      const updateRows = [{ rowNumber: 2, values: { ...importRows[0].values, 设备名称: "itest-import-device-1-updated", "itest-报警类型": "监管" } }];
      const updatePayload = await (
        await apiFetch(harness.baseUrl, "/api/tenant/device-import/commit", {
          tenantId: "tenant-huaxing",
          method: "POST",
          body: JSON.stringify({ fileName: "itest.xlsx", headers: Object.keys(updateRows[0].values), rows: updateRows, duplicatePolicy: "update" }),
        })
      ).json();
      assert.equal(updatePayload.updated, 1);

      const devicesPayload = await (await apiFetch(harness.baseUrl, "/api/tenant/devices", { tenantId: "tenant-huaxing" })).json();
      const imported = devicesPayload.devices.find((item) => item.deviceCode === "itest-import-device-1");
      assert.equal(imported.name, "itest-import-device-1-updated");
      assert.equal(imported.customAttributes[addedAttributePayload.attribute.fieldKey], "监管");
    });

    await runCase("repositories enforce tenant isolation for devices and users", async () => {
      await ensureTestDevice({ tenantId: "tenant-huaxing", deviceId: "itest-device-tenant-a", name: "itest-device-tenant-a" });
      await ensureTestDevice({ tenantId: "tenant-anhe", deviceId: "itest-device-tenant-b", name: "itest-device-tenant-b" });

      await tenantUserRepository.upsert("tenant-huaxing", {
        id: "itest-user-tenant-a",
        username: "itest_user_tenant_a",
        phone: "13900000011",
        roleKey: "tenant_level_2",
        status: "启用",
        smsEnabled: false,
        messageTypes: [],
        note: "repository-test",
      });
      await tenantUserRepository.upsert("tenant-anhe", {
        id: "itest-user-tenant-b",
        username: "itest_user_tenant_b",
        phone: "13900000012",
        roleKey: "tenant_level_2",
        status: "启用",
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

    await runCase("admin state snapshot replacement is disabled and preserves alarm workflow", async () => {
      const alarmId = "itest-admin-state-alarm";
      const deviceId = "itest-admin-state-device";
      await ensureTestDevice({ tenantId: "tenant-huaxing", deviceId, name: deviceId });
      await readRows(
        `INSERT INTO tenant_alarms (
          id, tenant_id, device_id, device_name, location, alarm_type, time, process_status, workflow_status
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (id) DO UPDATE SET workflow_status = EXCLUDED.workflow_status`,
        [alarmId, "tenant-huaxing", deviceId, deviceId, "itest", "itest", "2026-04-27 12:00:00", WORKFLOW_COMPLETED, WORKFLOW_COMPLETED],
      );
      await readRows(
        `INSERT INTO alarm_logs (
          id, tenant_id, alarm_id, action, from_status, to_status, operator_name, operator_role, note, attachments, created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)
        ON CONFLICT (id) DO NOTHING`,
        [
          "itest-admin-state-log",
          "tenant-huaxing",
          alarmId,
          "itest-workflow",
          alarmWorkflowStatuses[0],
          WORKFLOW_COMPLETED,
          "itest-operator",
          "tenant_level_1",
          "",
          "[]",
          "2026-04-27 12:01:00",
        ],
      );
      await readRows("UPDATE tenant_alarms SET workflow_status = $1, process_status = $1 WHERE id = $2", [
        alarmWorkflowStatuses[0],
        alarmId,
      ]);
      await seedDatabase();
      let rows = await readRows("SELECT workflow_status FROM tenant_alarms WHERE id = $1", [alarmId]);
      assert.equal(rows[0]?.workflow_status, WORKFLOW_COMPLETED);

      const response = await apiFetch(harness.baseUrl, "/api/admin/state", {
        method: "PUT",
        tenantId: "tenant-huaxing",
        scope: "platform",
        role: "platform_super_admin",
      });
      assert.equal(response.status, 410);

      rows = await readRows("SELECT workflow_status FROM tenant_alarms WHERE id = $1", [alarmId]);
      assert.equal(rows[0]?.workflow_status, WORKFLOW_COMPLETED);
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
      assert.ok(Array.isArray(platformScene.alarms));
      assert.ok(Array.isArray(platformScene.notificationRecords));
      assert.ok(platformScene.alarms.every((item) => item.tenantId === "tenant-huaxing"));
      assert.ok(platformScene.notificationRecords.every((item) => item.tenantId === "tenant-huaxing"));

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
        fileUrl: "/api/tenant/drawing-files/tenant-huaxing/itest/itest-drawing-crud.png",
        fileType: "image",
        sourceFileUrl: "/api/tenant/drawing-files/tenant-huaxing/itest/itest-drawing-crud.png",
        previewUrl: "/api/tenant/drawing-files/tenant-huaxing/itest/itest-drawing-crud.png",
        originalFileName: "itest-drawing-crud.png",
        fileSize: 128,
        width: 1280,
        height: 720,
        version: "v2.0",
        status: "draft",
        operatorName: "itest_operator",
        operatorRole: "tenant_level_1",
      });
      assert.equal(createdDrawing.tenantId, "tenant-huaxing");
      assert.equal(createdDrawing.status, "draft");
      assert.equal(createdDrawing.fileType, "image");
      assert.equal(createdDrawing.previewUrl, createdDrawing.fileUrl);
      assert.equal(createdDrawing.processingStatus, "ready");
      assert.equal(createdDrawing.sceneUrl, createdDrawing.fileUrl);

      const publishedDrawing = await tenantDrawingRepository.updateStatus("tenant-huaxing", createdDrawing.id, "published", {
        operatorName: "itest_operator",
        operatorRole: "tenant_level_1",
      });
      assert.equal(publishedDrawing.status, "published");
      assert.ok(publishedDrawing.publishedAt);

      const archivedDrawing = await tenantDrawingRepository.updateStatus("tenant-huaxing", createdDrawing.id, "archived", {
        operatorName: "itest_operator",
        operatorRole: "tenant_level_1",
      });
      assert.equal(archivedDrawing.status, "archived");

      const failedPdfDrawing = await tenantDrawingRepository.create("tenant-huaxing", {
        floorId: "floor-hx-a-1",
        name: "itest-drawing-pdf-failed",
        fileUrl: "/api/tenant/drawing-files/tenant-huaxing/itest/itest-broken.pdf",
        fileType: "pdf",
        sourceFileUrl: "/api/tenant/drawing-files/tenant-huaxing/itest/itest-broken.pdf",
        previewUrl: "/api/tenant/drawing-files/tenant-huaxing/itest/itest-broken.pdf",
        sceneUrl: "/api/tenant/drawing-files/tenant-huaxing/itest/itest-broken.pdf",
        originalFileName: "itest-broken.pdf",
        fileSize: 512,
        processingStatus: "failed",
        processingMessage: "itest pdf preview unavailable",
        conversionLog: ["uploaded", "pdf preview missing"],
        width: 1600,
        height: 900,
        version: "v1.0",
        status: "draft",
        operatorName: "itest_operator",
        operatorRole: "tenant_level_1",
      });
      assert.equal(failedPdfDrawing.fileType, "pdf");
      assert.equal(failedPdfDrawing.processingStatus, "failed");
      assert.ok(failedPdfDrawing.conversionLog.includes("pdf preview missing"));

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
      const endpointDrawingResponse = await apiFetch(harness.baseUrl, "/api/tenant/drawings", {
        tenantId: "tenant-huaxing",
        method: "POST",
        body: JSON.stringify({
          floorId: "floor-hx-a-1",
          name: "itest-drawing-endpoint-status",
          fileUrl: "/api/tenant/drawing-files/tenant-huaxing/itest/endpoint.pdf",
          fileType: "pdf",
          sourceFileUrl: "/api/tenant/drawing-files/tenant-huaxing/itest/endpoint.pdf",
          previewUrl: "/api/tenant/drawing-files/tenant-huaxing/itest/endpoint.pdf",
          originalFileName: "endpoint.pdf",
          fileSize: 256,
          width: 1000,
          height: 1414,
          version: "v1.0",
          status: "draft",
        }),
      });
      assert.equal(endpointDrawingResponse.status, 200);
      const endpointDrawing = (await endpointDrawingResponse.json()).drawing;
      assert.equal(endpointDrawing.fileType, "pdf");
      assert.equal(endpointDrawing.status, "draft");

      const publishResponse = await apiFetch(harness.baseUrl, `/api/tenant/drawings/${endpointDrawing.id}/publish`, {
        tenantId: "tenant-huaxing",
        method: "POST",
      });
      assert.equal(publishResponse.status, 200);
      assert.equal((await publishResponse.json()).drawing.status, "published");

      const archiveResponse = await apiFetch(harness.baseUrl, `/api/tenant/drawings/${endpointDrawing.id}/archive`, {
        tenantId: "tenant-huaxing",
        method: "POST",
      });
      assert.equal(archiveResponse.status, 200);
      assert.equal((await archiveResponse.json()).drawing.status, "archived");

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

    await runCase("spatial area and floor endpoints support no-floor drawings and delete guards", async () => {
      const floorAreaResponse = await apiFetch(harness.baseUrl, "/api/tenant/spatial-areas", {
        tenantId: "tenant-huaxing",
        method: "POST",
        body: JSON.stringify({
          name: "itest-floor-area",
          code: "ITEST-F",
          areaType: "factory",
          hasFloors: true,
          sortOrder: 98,
          status: "active",
        }),
      });
      assert.equal(floorAreaResponse.status, 200);
      const floorArea = (await floorAreaResponse.json()).area;

      const floorResponse = await apiFetch(harness.baseUrl, "/api/tenant/floors", {
        tenantId: "tenant-huaxing",
        method: "POST",
        body: JSON.stringify({
          buildingId: floorArea.id,
          name: "itest-1F",
          code: "ITEST-1F",
          levelIndex: 1,
          sortOrder: 1,
          status: "active",
        }),
      });
      assert.equal(floorResponse.status, 200);
      const floor = (await floorResponse.json()).floor;
      assert.equal(floor.buildingId, floorArea.id);

      const patchFloorResponse = await apiFetch(harness.baseUrl, `/api/tenant/floors/${floor.id}`, {
        tenantId: "tenant-huaxing",
        method: "PATCH",
        body: JSON.stringify({ name: "itest-1F-renamed", sortOrder: 2 }),
      });
      assert.equal(patchFloorResponse.status, 200);
      assert.equal((await patchFloorResponse.json()).floor.name, "itest-1F-renamed");

      const deleteFloorResponse = await apiFetch(harness.baseUrl, `/api/tenant/floors/${floor.id}`, {
        tenantId: "tenant-huaxing",
        method: "DELETE",
      });
      assert.equal(deleteFloorResponse.status, 200);
      const deleteFloorAreaResponse = await apiFetch(harness.baseUrl, `/api/tenant/spatial-areas/${floorArea.id}`, {
        tenantId: "tenant-huaxing",
        method: "DELETE",
      });
      assert.equal(deleteFloorAreaResponse.status, 200);

      const areaResponse = await apiFetch(harness.baseUrl, "/api/tenant/spatial-areas", {
        tenantId: "tenant-huaxing",
        method: "POST",
        body: JSON.stringify({
          name: "itest-no-floor-area",
          code: "ITEST-NF",
          areaType: "outdoor",
          hasFloors: false,
          sortOrder: 99,
          status: "active",
          description: "integration no-floor area",
        }),
      });
      assert.equal(areaResponse.status, 200);
      const area = (await areaResponse.json()).area;
      assert.equal(area.hasFloors, false);

      const deviceId = "itest-device-no-floor-point";
      await ensureTestDevice({ tenantId: "tenant-huaxing", deviceId, name: "itest-device-no-floor-point" });

      const drawing = await tenantDrawingRepository.create("tenant-huaxing", {
        buildingId: area.id,
        name: "itest-area-plane",
        fileUrl: "/api/tenant/drawing-files/tenant-huaxing/itest/area-plane.png",
        fileType: "image",
        width: 1200,
        height: 800,
        version: "v1.0",
        status: "draft",
        operatorName: "itest_operator",
        operatorRole: "tenant_level_1",
      });
      assert.equal(drawing.buildingId, area.id);
      assert.equal(drawing.floorId, "");

      const point = await tenantDevicePointRepository.upsert("tenant-huaxing", {
        deviceId,
        buildingId: area.id,
        drawingId: drawing.id,
        x: 0.25,
        y: 0.75,
        icon: "sensor",
        operatorName: "itest_operator",
        operatorRole: "tenant_level_1",
      });
      assert.equal(point.buildingId, area.id);
      assert.equal(point.floorId, "");

      const guardedDelete = await apiFetch(harness.baseUrl, `/api/tenant/spatial-areas/${area.id}`, {
        tenantId: "tenant-huaxing",
        method: "DELETE",
      });
      assert.equal(guardedDelete.status, 400);

      await tenantDrawingRepository.remove("tenant-huaxing", drawing.id, {
        operatorName: "itest_operator",
        operatorRole: "tenant_level_1",
      });
      const finalDelete = await apiFetch(harness.baseUrl, `/api/tenant/spatial-areas/${area.id}`, {
        tenantId: "tenant-huaxing",
        method: "DELETE",
      });
      assert.equal(finalDelete.status, 200);
    });

    await runCase("spatial area endpoint can save floor configuration transactionally", async () => {
      const areaResponse = await apiFetch(harness.baseUrl, "/api/tenant/spatial-areas", {
        tenantId: "tenant-huaxing",
        method: "POST",
        body: JSON.stringify({
          name: "itest-bundled-floor-area",
          code: "ITEST-BF",
          areaType: "factory",
          hasFloors: true,
          sortOrder: 97,
          status: "active",
          floors: [
            { name: "itest-bundled-1F", code: "ITEST-BF-1", levelIndex: 1, sortOrder: 1, status: "active" },
            { name: "itest-bundled-2F", code: "ITEST-BF-2", levelIndex: 2, sortOrder: 2, status: "inactive" },
          ],
        }),
      });
      assert.equal(areaResponse.status, 200);
      const areaPayload = await areaResponse.json();
      const area = areaPayload.area;
      assert.equal(area.hasFloors, true);
      assert.equal(areaPayload.floors.length, 2);

      const firstFloor = areaPayload.floors.find((floor) => floor.name === "itest-bundled-1F");
      const secondFloor = areaPayload.floors.find((floor) => floor.name === "itest-bundled-2F");
      assert.ok(firstFloor?.id);
      assert.ok(secondFloor?.id);

      const patchResponse = await apiFetch(harness.baseUrl, `/api/tenant/spatial-areas/${area.id}`, {
        tenantId: "tenant-huaxing",
        method: "PATCH",
        body: JSON.stringify({
          name: "itest-bundled-floor-area-renamed",
          hasFloors: true,
          floors: [
            {
              id: firstFloor.id,
              name: "itest-bundled-1F-renamed",
              code: firstFloor.code,
              levelIndex: 1,
              sortOrder: 1,
              status: "active",
            },
          ],
          deletedFloorIds: [secondFloor.id],
        }),
      });
      assert.equal(patchResponse.status, 200);
      const patchPayload = await patchResponse.json();
      assert.equal(patchPayload.area.name, "itest-bundled-floor-area-renamed");
      assert.equal(patchPayload.floors.length, 1);
      assert.equal(patchPayload.floors[0].name, "itest-bundled-1F-renamed");

      const guardedDrawing = await tenantDrawingRepository.create("tenant-huaxing", {
        floorId: firstFloor.id,
        name: "itest-bundled-floor-guard",
        fileUrl: "/api/tenant/drawing-files/tenant-huaxing/itest/bundled-floor-guard.png",
        fileType: "image",
        width: 800,
        height: 600,
        version: "v1.0",
        status: "draft",
        operatorName: "itest_operator",
        operatorRole: "tenant_level_1",
      });
      const guardedPatch = await apiFetch(harness.baseUrl, `/api/tenant/spatial-areas/${area.id}`, {
        tenantId: "tenant-huaxing",
        method: "PATCH",
        body: JSON.stringify({
          hasFloors: false,
          deletedFloorIds: [firstFloor.id],
        }),
      });
      assert.equal(guardedPatch.status, 400);

      await tenantDrawingRepository.remove("tenant-huaxing", guardedDrawing.id, {
        operatorName: "itest_operator",
        operatorRole: "tenant_level_1",
      });
      const noFloorPatch = await apiFetch(harness.baseUrl, `/api/tenant/spatial-areas/${area.id}`, {
        tenantId: "tenant-huaxing",
        method: "PATCH",
        body: JSON.stringify({
          hasFloors: false,
          deletedFloorIds: [firstFloor.id],
        }),
      });
      assert.equal(noFloorPatch.status, 200);
      const noFloorPayload = await noFloorPatch.json();
      assert.equal(noFloorPayload.area.hasFloors, false);
      assert.equal(noFloorPayload.floors.length, 0);

      const deleteAreaResponse = await apiFetch(harness.baseUrl, `/api/tenant/spatial-areas/${area.id}`, {
        tenantId: "tenant-huaxing",
        method: "DELETE",
      });
      assert.equal(deleteAreaResponse.status, 200);
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

    await runCase("ingestion chain stacks repeated alarms for the same device", async () => {
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
            const createdCount = (realtimeBuffer.match(/"type":"alarm_created"/g) ?? []).length;
            if (createdCount >= 2) {
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
        body: JSON.stringify({
          ...alarmEvent,
          event_id: "itest-event-1-repeat",
          event_time: new Date(Date.now() + 1000).toISOString(),
        }),
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
        assert.equal(duplicatePayload.workflow.alarm_created, true);
        assert.equal(duplicatePayload.workflow.duplicate_suppressed, false);

        const alarmRows = await readRows(
          "SELECT id FROM tenant_alarms WHERE tenant_id = $1 AND device_id = $2",
          ["tenant-huaxing", deviceId],
        );
        assert.equal(alarmRows.length, 2);

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
        assert.equal(workflowRows.length, 2);
        assert.notEqual(workflowRows[0].workflow_status, "已关闭");
        assert.notEqual(workflowRows[0].workflow_status, "已完成");
        const recoveredDeviceRows = await readRows(
          "SELECT status FROM tenant_devices WHERE tenant_id = $1 AND id = $2",
          ["tenant-huaxing", deviceId],
        );
        assert.equal(recoveredDeviceRows[0].status, "正常");

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

    await runCase("fault ingestion keeps overview, alarm-center and devices consistent", async () => {
      const deviceId = "itest-device-fault";
      await ensureTestDevice({ tenantId: "tenant-huaxing", deviceId, name: "itest-device-fault" });

      const ingestResponse = await apiFetch(harness.baseUrl, "/api/ingestion/event", {
        tenantId: "tenant-huaxing",
        scope: "platform",
        role: "platform_super_admin",
        method: "POST",
        body: JSON.stringify({
          event_id: "itest-event-fault-1",
          tenant_id: "tenant-huaxing",
          device_id: deviceId,
          event_type: "fault",
          event_value: { code: "E01" },
          event_time: new Date().toISOString(),
        }),
      });
      assert.equal(ingestResponse.status, 200);
      const ingestPayload = await ingestResponse.json();
      assert.equal(ingestPayload.device_status, "fault");

      const devicesPayload = await (await apiFetch(harness.baseUrl, "/api/tenant/devices", { tenantId: "tenant-huaxing" })).json();
      const device = devicesPayload.devices.find((item) => item.id === deviceId);
      assert.equal(device?.status, "故障");

      const alarmCenterPayload = await (await apiFetch(harness.baseUrl, "/api/tenant/alarm-center", { tenantId: "tenant-huaxing" })).json();
      const alarm = alarmCenterPayload.alarms.find((item) => item.deviceId === deviceId);
      assert.ok(alarm);
      assert.equal(alarm.alarmType, "设备故障");

      const overviewPayload = await (await apiFetch(harness.baseUrl, "/api/tenant/overview", { tenantId: "tenant-huaxing" })).json();
      const overviewDevice = overviewPayload.devices.find((item) => item.id === deviceId);
      const overviewAlarm = overviewPayload.alarms.find((item) => item.deviceId === deviceId);
      assert.equal(overviewDevice?.status, device.status);
      assert.equal(overviewAlarm?.alarmType, alarm.alarmType);
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

    await runCase("platform notices publish to all or selected tenants without touching alarm notifications", async () => {
      const beforeNotificationRecords = await readRows("SELECT COUNT(*)::int AS count FROM notification_records");
      const beforeNotificationTemplates = await readRows("SELECT COUNT(*)::int AS count FROM notification_templates");

      const allTitle = `itest-platform-notice-all-${Date.now()}`;
      const allResponse = await apiFetch(harness.baseUrl, "/api/admin/platform-notices", {
        tenantId: "",
        scope: "platform",
        role: "platform_super_admin",
        method: "POST",
        body: JSON.stringify({
          title: allTitle,
          content: "integration all tenants",
          level: "warning",
          targetMode: "all",
          attachments: [
            {
              id: "itest-platform-notice-attachment",
              name: "itest-platform-notice.pdf",
              url: "/api/platform-notice-files/itest/itest-platform-notice.pdf",
              size: 2048,
              contentType: "application/pdf",
            },
          ],
        }),
      });
      assert.equal(allResponse.status, 200);
      const allPayload = await allResponse.json();
      assert.ok(allPayload.notice);
      assert.ok(allPayload.notice.targetTenantCount >= 2);
      assert.equal(allPayload.notice.attachments.length, 1);

      const tenantCountRows = await readRows("SELECT COUNT(*)::int AS count FROM tenants");
      const allDeliveryRows = await readRows(
        `SELECT delivery.tenant_id
         FROM platform_notice_deliveries delivery
         INNER JOIN platform_notices notice ON notice.id = delivery.notice_id
         WHERE notice.title = $1`,
        [allTitle],
      );
      assert.equal(allDeliveryRows.length, tenantCountRows[0].count);

      const selectedTitle = `itest-platform-notice-selected-${Date.now()}`;
      const selectedResponse = await apiFetch(harness.baseUrl, "/api/admin/platform-notices", {
        tenantId: "",
        scope: "platform",
        role: "platform_super_admin",
        method: "POST",
        body: JSON.stringify({
          title: selectedTitle,
          content: "integration selected tenant",
          level: "critical",
          targetMode: "selected",
          tenantIds: ["tenant-anhe"],
        }),
      });
      assert.equal(selectedResponse.status, 200);
      const selectedPayload = await selectedResponse.json();
      assert.equal(selectedPayload.notice.targetTenantCount, 1);

      const huaxingNotices = await (
        await apiFetch(harness.baseUrl, "/api/tenant/platform-notices", { tenantId: "tenant-huaxing" })
      ).json();
      assert.ok(huaxingNotices.notices.some((item) => item.title === allTitle));
      assert.ok(
        huaxingNotices.notices.some(
          (item) =>
            item.title === allTitle &&
            item.attachments.some((attachment) => attachment.name === "itest-platform-notice.pdf"),
        ),
      );
      assert.ok(!huaxingNotices.notices.some((item) => item.title === selectedTitle));

      const anheNotices = await (
        await apiFetch(harness.baseUrl, "/api/tenant/platform-notices", { tenantId: "tenant-anhe" })
      ).json();
      assert.ok(anheNotices.notices.some((item) => item.title === selectedTitle));

      const draftTitle = `itest-platform-notice-draft-${Date.now()}`;
      const draftResponse = await apiFetch(harness.baseUrl, "/api/admin/platform-notices/drafts", {
        tenantId: "",
        scope: "platform",
        role: "platform_super_admin",
        method: "POST",
        body: JSON.stringify({
          title: draftTitle,
          content: "draft before publish",
          level: "info",
          targetMode: "selected",
          tenantIds: ["tenant-huaxing"],
          attachments: [
            {
              id: `itest-platform-notice-draft-attachment-${Date.now()}`,
              name: "itest-platform-notice-draft.pdf",
              url: "/api/platform-notice-files/itest/itest-platform-notice-draft.pdf",
              size: 4096,
              contentType: "application/pdf",
            },
          ],
        }),
      });
      assert.equal(draftResponse.status, 200);
      const draftPayload = await draftResponse.json();
      assert.equal(draftPayload.notice.status, "draft");
      assert.equal(draftPayload.notice.attachments.length, 1);
      assert.deepEqual(draftPayload.notice.targetTenantIds, ["tenant-huaxing"]);

      const draftDeliveryRows = await readRows("SELECT * FROM platform_notice_deliveries WHERE notice_id = $1", [
        draftPayload.notice.id,
      ]);
      assert.equal(draftDeliveryRows.length, 0);
      const huaxingBeforeDraftPublish = await (
        await apiFetch(harness.baseUrl, "/api/tenant/platform-notices", { tenantId: "tenant-huaxing" })
      ).json();
      assert.ok(!huaxingBeforeDraftPublish.notices.some((item) => item.title === draftTitle));

      const updatedDraftResponse = await apiFetch(
        harness.baseUrl,
        `/api/admin/platform-notices/${encodeURIComponent(draftPayload.notice.id)}`,
        {
          tenantId: "",
          scope: "platform",
          role: "platform_super_admin",
          method: "PATCH",
          body: JSON.stringify({
            title: `${draftTitle}-updated`,
            content: "draft updated before publish",
            level: "warning",
            targetMode: "selected",
            tenantIds: ["tenant-huaxing"],
            attachmentIds: draftPayload.notice.attachments.map((item) => item.id),
          }),
        },
      );
      assert.equal(updatedDraftResponse.status, 200);
      const updatedDraftPayload = await updatedDraftResponse.json();
      assert.equal(updatedDraftPayload.notice.status, "draft");
      assert.equal(updatedDraftPayload.notice.attachments[0].name, "itest-platform-notice-draft.pdf");

      const publishDraftResponse = await apiFetch(
        harness.baseUrl,
        `/api/admin/platform-notices/${encodeURIComponent(draftPayload.notice.id)}/publish`,
        {
          tenantId: "",
          scope: "platform",
          role: "platform_super_admin",
          method: "POST",
          body: JSON.stringify({ requestId: `itest-draft-publish-${Date.now()}` }),
        },
      );
      assert.equal(publishDraftResponse.status, 200);
      const publishDraftPayload = await publishDraftResponse.json();
      assert.equal(publishDraftPayload.notice.status, "sent");
      assert.equal(publishDraftPayload.notice.targetTenantCount, 1);
      const huaxingAfterDraftPublish = await (
        await apiFetch(harness.baseUrl, "/api/tenant/platform-notices", { tenantId: "tenant-huaxing" })
      ).json();
      assert.ok(huaxingAfterDraftPublish.notices.some((item) => item.title === `${draftTitle}-updated`));

      const reeditResponse = await apiFetch(
        harness.baseUrl,
        `/api/admin/platform-notices/${encodeURIComponent(selectedPayload.notice.id)}/reedit-draft`,
        {
          tenantId: "",
          scope: "platform",
          role: "platform_super_admin",
          method: "POST",
        },
      );
      assert.equal(reeditResponse.status, 200);
      const reeditPayload = await reeditResponse.json();
      assert.equal(reeditPayload.notice.status, "draft");
      assert.equal(reeditPayload.notice.title, selectedTitle);
      assert.deepEqual(reeditPayload.notice.targetTenantIds, ["tenant-anhe"]);

      const selectedAfterReeditRows = await readRows("SELECT status FROM platform_notices WHERE id = $1", [
        selectedPayload.notice.id,
      ]);
      assert.equal(selectedAfterReeditRows[0].status, "revoked");
      const anheAfterReedit = await (
        await apiFetch(harness.baseUrl, "/api/tenant/platform-notices", { tenantId: "tenant-anhe" })
      ).json();
      assert.ok(!anheAfterReedit.notices.some((item) => item.title === selectedTitle));

      const forbiddenResponse = await apiFetch(harness.baseUrl, "/api/admin/platform-notices", {
        tenantId: "tenant-huaxing",
        method: "POST",
        body: JSON.stringify({
          title: "itest-platform-notice-forbidden",
          content: "should not publish",
          targetMode: "all",
        }),
      });
      assert.equal(forbiddenResponse.status, 403);

      const afterNotificationRecords = await readRows("SELECT COUNT(*)::int AS count FROM notification_records");
      const afterNotificationTemplates = await readRows("SELECT COUNT(*)::int AS count FROM notification_templates");
      assert.equal(afterNotificationRecords[0].count, beforeNotificationRecords[0].count);
      assert.equal(afterNotificationTemplates[0].count, beforeNotificationTemplates[0].count);
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
