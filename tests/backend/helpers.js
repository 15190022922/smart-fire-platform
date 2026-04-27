const { once } = require("node:events");
const { Pool } = require("pg");
const { createBackendServer } = require("../../apps/backend/.dist/apps/backend/src/server.js");
const { loadBackendEnv } = require("../../apps/backend/.dist/apps/backend/src/lib/load-env.js");

loadBackendEnv();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

async function startBackendHarness() {
  const server = createBackendServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      server.close();
      await once(server, "close");
    },
  };
}

function requestHeaders(tenantId, userName = "integration_tester", scope = "tenant", role = "tenant_level_1") {
  return {
    "Content-Type": "application/json",
    "x-user-scope": scope,
    "x-tenant-id": tenantId,
    "x-user-name": encodeURIComponent(userName),
    "x-user-role": role,
  };
}

async function apiFetch(baseUrl, path, init = { tenantId: "tenant-huaxing" }) {
  const { tenantId, userName, scope, role, headers, ...rest } = init;
  return fetch(`${baseUrl}${path}`, {
    ...rest,
    headers: {
      ...requestHeaders(tenantId, userName, scope, role),
      ...(headers || {}),
    },
  });
}

async function cleanupIntegrationArtifacts() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cleanupStatements = [
      "DELETE FROM notification_records WHERE id LIKE 'itest-%' OR alarm_id LIKE 'itest-%' OR device_id LIKE 'itest-%' OR target_user LIKE 'itest-%' OR target_name LIKE 'itest-%'",
      "DELETE FROM alarm_logs WHERE id LIKE 'itest-%' OR alarm_id LIKE 'itest-%'",
      "DELETE FROM audit_logs WHERE id LIKE 'itest-%' OR target_id LIKE 'itest-%' OR actor_name LIKE 'itest-%'",
      "DELETE FROM raw_device_events WHERE id LIKE 'itest-%' OR device_id LIKE 'itest-%' OR event_id LIKE 'itest-%' OR dedupe_key LIKE 'event-id:%itest-%'",
      "DELETE FROM device_status_snapshots WHERE device_id LIKE 'itest-%'",
      "DELETE FROM tenant_device_points WHERE device_id LIKE 'itest-%' OR id LIKE 'itest-%'",
      "DELETE FROM tenant_drawings WHERE id LIKE 'itest-%' OR name LIKE 'itest-%'",
      "DELETE FROM tenant_alarms WHERE id LIKE 'itest-%' OR device_id LIKE 'itest-%'",
      "DELETE FROM duty_logs WHERE id LIKE 'itest-%' OR schedule_id LIKE 'itest-%'",
      "DELETE FROM duty_schedules WHERE id LIKE 'itest-%' OR assignee_name LIKE 'itest-%'",
      "DELETE FROM inspection_records WHERE id LIKE 'itest-%' OR task_id LIKE 'itest-%'",
      "DELETE FROM issues WHERE id LIKE 'itest-%' OR source_id LIKE 'itest-%'",
      "DELETE FROM inspection_tasks WHERE id LIKE 'itest-%' OR title LIKE 'itest-%'",
      "DELETE FROM login_accounts WHERE id LIKE 'itest-%' OR username LIKE 'itest_%'",
      "DELETE FROM tenant_users WHERE id LIKE 'itest-%' OR username LIKE 'itest_%'",
      "DELETE FROM tenant_devices WHERE id LIKE 'itest-%' OR name LIKE 'itest-%' OR name LIKE '[FORCE_NOTIFY_FAIL] itest-%'",
      "DELETE FROM tenants WHERE id LIKE 'itest-%' OR code LIKE 'ITEST-%'",
    ];
    for (const statement of cleanupStatements) {
      await client.query(statement);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function formatLocalTimestamp(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

async function ensureTestDevice({ tenantId, deviceId, name, status = "正常" }) {
  await pool.query(
    `
      INSERT INTO tenant_devices (
        id, tenant_id, name, type, area, installation_location, status, last_report_at, notes
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        area = EXCLUDED.area,
        installation_location = EXCLUDED.installation_location,
        status = EXCLUDED.status,
        last_report_at = EXCLUDED.last_report_at,
        notes = EXCLUDED.notes
    `,
    [deviceId, tenantId, name || deviceId, "烟感探测器", "集成测试区", "测试点位", status, formatLocalTimestamp(), "integration"],
  );
}

async function readRows(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

async function closePool() {
  await pool.end();
}

module.exports = {
  startBackendHarness,
  apiFetch,
  cleanupIntegrationArtifacts,
  ensureTestDevice,
  readRows,
  closePool,
};
