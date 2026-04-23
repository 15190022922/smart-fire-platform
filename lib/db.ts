/* eslint-disable @typescript-eslint/no-explicit-any */
import { Pool, type PoolClient } from "pg";
import { hashPassword, verifyPassword } from "./password";
import { publishTenantEvent } from "../packages/realtime/src/server";
import type {
  DeviceStatusSnapshotRecord,
  RawDeviceEventRecord,
  TenantBuildingRecord,
  TenantDevicePointRecord,
  TenantDrawingRecord,
  TenantFloorRecord,
  TenantGatewayRecord,
  TenantSiteRecord,
  TenantSpatialModel,
} from "../types/hardware";
import type {
  PlanRecord,
  PlatformUserRecord,
  SubscriptionRecord,
  TenantAlarmRecord,
  TenantDeviceRecord,
  TenantRecord,
  TenantUserRecord,
} from "../types/saas";
import type {
  AlarmCenterItem,
  AlarmTimelineEntry,
  AlarmWorkflowStatus,
  AuditLogRecord,
  NotificationRecord,
  NotificationTemplateRecord,
  SystemHealthPayload,
  SystemHealthMetric,
} from "../types/ops";
import type { DutyCenterPayload, DutyLogRecord, DutyScheduleRecord, DutyShiftRecord } from "../types/duty";
import type {
  InspectionCenterPayload,
  InspectionRecord,
  InspectionTaskRecord,
  IssueRecord,
  MaintenanceRecord,
} from "../types/inspection";

function getDatabaseUrl() {
  return process.env.DATABASE_URL;
}

type QueryResultRow = Record<string, unknown>;

type CreateTenantWithAdminInput = {
  tenant: {
    name: string;
    code: string;
    industry: string;
    contactName: string;
    contactPhone: string;
    status: string;
    note: string;
  };
  admin: {
    username: string;
    displayName: string;
    phone: string;
    password: string;
    roleKey: string;
    note: string;
  };
};

type UpdateTenantInput = {
  id: string;
  name: string;
  code: string;
  industry: string;
  contactName: string;
  contactPhone: string;
  status: string;
  note: string;
};

declare global {
  var __smartFirePgPool: Pool | undefined;
  var __smartFirePgInitPromise: Promise<void> | undefined;
}

function getPool() {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!globalThis.__smartFirePgPool) {
    let ssl: false | { rejectUnauthorized: false } = { rejectUnauthorized: false };

    try {
      const parsed = new URL(databaseUrl);
      const host = parsed.hostname;
      const sslMode = parsed.searchParams.get("sslmode");
      const isLocalHost =
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "::1" ||
        host.startsWith("192.168.") ||
        host.startsWith("10.") ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

      if (isLocalHost || sslMode === "disable") {
        ssl = false;
      }
    } catch {
      ssl = databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false };
    }

    globalThis.__smartFirePgPool = new Pool({
      connectionString: databaseUrl,
      ssl,
      max: 10,
    });
  }

  return globalThis.__smartFirePgPool;
}

export async function withClient<T>(runner: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try {
    return await runner(client);
  } finally {
    client.release();
  }
}

async function query<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []) {
  return getPool().query<T>(sql, params);
}

function formatDateParts(date: Date, timeZone = "Asia/Shanghai") {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value])) as Record<string, string>;
}

export function formatLocalTimestamp(date = new Date(), timeZone = "Asia/Shanghai") {
  const parts = formatDateParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function formatLocalDate(date = new Date(), timeZone = "Asia/Shanghai") {
  const parts = formatDateParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseDbDate(value: string) {
  const normalized = String(value ?? "").trim().replace("T", " ");
  const [datePart, timePart = "00:00:00"] = normalized.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = timePart.split(":").map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1, hour || 0, minute || 0, second || 0);
}

async function createSchema(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS login_accounts (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL DEFAULT '',
      display_name TEXT NOT NULL,
      scope TEXT NOT NULL,
      role_key TEXT NOT NULL,
      tenant_id TEXT
    );

    ALTER TABLE login_accounts ADD COLUMN IF NOT EXISTS password_hash TEXT;
    ALTER TABLE login_accounts ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      industry TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      contact_phone TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      note TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL,
      price_monthly INTEGER NOT NULL,
      max_devices INTEGER NOT NULL,
      max_users INTEGER NOT NULL,
      sms_quota INTEGER NOT NULL,
      feature_keys JSONB NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      status TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      trial BOOLEAN NOT NULL,
      auto_renew BOOLEAN NOT NULL
    );

    CREATE TABLE IF NOT EXISTS platform_users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      role_key TEXT NOT NULL,
      status TEXT NOT NULL,
      note TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tenant_users (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      username TEXT NOT NULL,
      phone TEXT NOT NULL,
      role_key TEXT NOT NULL,
      status TEXT NOT NULL,
      sms_enabled BOOLEAN NOT NULL,
      message_types JSONB NOT NULL,
      note TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tenant_devices (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      area TEXT NOT NULL,
      installation_location TEXT NOT NULL,
      status TEXT NOT NULL,
      last_report_at TEXT NOT NULL,
      notes TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tenant_alarms (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      device_name TEXT NOT NULL,
      location TEXT NOT NULL,
      alarm_type TEXT NOT NULL,
      time TEXT NOT NULL,
      process_status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_settings (
      id TEXT PRIMARY KEY,
      tenant_id TEXT UNIQUE NOT NULL,
      alarm_threshold TEXT NOT NULL,
      notification_enabled BOOLEAN NOT NULL,
      map_placeholder TEXT NOT NULL,
      remark TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quota_usage (
      id TEXT PRIMARY KEY,
      tenant_id TEXT UNIQUE NOT NULL,
      device_count INTEGER NOT NULL,
      user_count INTEGER NOT NULL,
      sms_used INTEGER NOT NULL
    );

    ALTER TABLE tenant_devices ADD COLUMN IF NOT EXISTS site_id TEXT;
    ALTER TABLE tenant_devices ADD COLUMN IF NOT EXISTS building_id TEXT;
    ALTER TABLE tenant_devices ADD COLUMN IF NOT EXISTS floor_id TEXT;
    ALTER TABLE tenant_devices ADD COLUMN IF NOT EXISTS gateway_id TEXT;
    ALTER TABLE tenant_devices ADD COLUMN IF NOT EXISTS model_code TEXT NOT NULL DEFAULT '';
    ALTER TABLE tenant_devices ADD COLUMN IF NOT EXISTS protocol_type TEXT NOT NULL DEFAULT '';
    ALTER TABLE tenant_devices ADD COLUMN IF NOT EXISTS serial_number TEXT NOT NULL DEFAULT '';

    CREATE TABLE IF NOT EXISTS tenant_sites (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      address TEXT NOT NULL,
      status TEXT NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tenant_buildings (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      site_id TEXT NOT NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      level_count INTEGER NOT NULL,
      usage_type TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tenant_floors (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      building_id TEXT NOT NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      level_index INTEGER NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tenant_drawings (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      floor_id TEXT NOT NULL,
      name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      version TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tenant_gateways (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      site_id TEXT NOT NULL,
      name TEXT NOT NULL,
      protocol TEXT NOT NULL,
      serial_number TEXT NOT NULL,
      status TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tenant_device_points (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      floor_id TEXT NOT NULL,
      drawing_id TEXT NOT NULL,
      x DOUBLE PRECISION NOT NULL,
      y DOUBLE PRECISION NOT NULL,
      rotation DOUBLE PRECISION NOT NULL DEFAULT 0,
      icon TEXT NOT NULL,
      status_style TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS raw_device_events (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      gateway_id TEXT,
      event_type TEXT NOT NULL,
      event_code TEXT NOT NULL,
      event_level TEXT NOT NULL,
      payload JSONB NOT NULL,
      reported_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS device_status_snapshots (
      device_id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      gateway_id TEXT,
      status TEXT NOT NULL,
      last_event_type TEXT NOT NULL,
      last_event_code TEXT NOT NULL,
      last_reported_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    ALTER TABLE tenant_alarms ADD COLUMN IF NOT EXISTS workflow_status TEXT NOT NULL DEFAULT '未处理';
    ALTER TABLE tenant_alarms ADD COLUMN IF NOT EXISTS false_alarm BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE tenant_alarms ADD COLUMN IF NOT EXISTS detail_note TEXT NOT NULL DEFAULT '';
    ALTER TABLE tenant_alarms ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE tenant_alarms ADD COLUMN IF NOT EXISTS assigned_user_name TEXT NOT NULL DEFAULT '';
    ALTER TABLE tenant_alarms ADD COLUMN IF NOT EXISTS last_operator_name TEXT NOT NULL DEFAULT '';
    ALTER TABLE tenant_alarms ADD COLUMN IF NOT EXISTS acknowledged_at TEXT;
    ALTER TABLE tenant_alarms ADD COLUMN IF NOT EXISTS processing_at TEXT;
    ALTER TABLE tenant_alarms ADD COLUMN IF NOT EXISTS completed_at TEXT;
    ALTER TABLE tenant_alarms ADD COLUMN IF NOT EXISTS closed_at TEXT;
    ALTER TABLE tenant_alarms ADD COLUMN IF NOT EXISTS closed_reason TEXT NOT NULL DEFAULT '';

    CREATE TABLE IF NOT EXISTS alarm_logs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      alarm_id TEXT NOT NULL,
      action TEXT NOT NULL,
      from_status TEXT NOT NULL,
      to_status TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      operator_role TEXT NOT NULL,
      note TEXT NOT NULL,
      attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_templates (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      channel TEXT NOT NULL,
      level TEXT NOT NULL,
      target_roles JSONB NOT NULL,
      template_text TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_records (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      alarm_id TEXT,
      device_id TEXT,
      template_id TEXT,
      notify_type TEXT NOT NULL DEFAULT 'station',
      channel TEXT NOT NULL,
      level TEXT NOT NULL,
      target_name TEXT NOT NULL,
      target_role TEXT NOT NULL DEFAULT '',
      target_user TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      status TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    ALTER TABLE notification_records ADD COLUMN IF NOT EXISTS device_id TEXT;
    ALTER TABLE notification_records ADD COLUMN IF NOT EXISTS notify_type TEXT NOT NULL DEFAULT 'station';
    ALTER TABLE notification_records ADD COLUMN IF NOT EXISTS target_role TEXT NOT NULL DEFAULT '';
    ALTER TABLE notification_records ADD COLUMN IF NOT EXISTS target_user TEXT NOT NULL DEFAULT '';

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      actor_scope TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      result TEXT NOT NULL,
      detail TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_health_snapshots (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      metric_code TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      metric_value DOUBLE PRECISION NOT NULL,
      metric_unit TEXT NOT NULL,
      level TEXT NOT NULL,
      detail TEXT NOT NULL,
      recorded_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS duty_shifts (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      is_default BOOLEAN NOT NULL DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS duty_schedules (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      duty_date TEXT NOT NULL,
      shift_id TEXT NOT NULL,
      assignee_name TEXT NOT NULL,
      assignee_phone TEXT NOT NULL,
      assigned_by TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT,
      ended_at TEXT,
      handover_note TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS duty_logs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      schedule_id TEXT,
      log_type TEXT NOT NULL,
      content TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inspection_tasks (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      title TEXT NOT NULL,
      plan_type TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      target_name TEXT NOT NULL,
      due_date TEXT NOT NULL,
      assigned_to TEXT NOT NULL,
      status TEXT NOT NULL,
      note TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inspection_records (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      result TEXT NOT NULL,
      note TEXT NOT NULL,
      inspected_by TEXT NOT NULL,
      inspected_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      title TEXT NOT NULL,
      level TEXT NOT NULL,
      status TEXT NOT NULL,
      note TEXT NOT NULL,
      rectification_deadline TEXT,
      rectified_at TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS maintenance_records (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      device_name TEXT NOT NULL,
      vendor_name TEXT NOT NULL,
      maintenance_date TEXT NOT NULL,
      next_due_date TEXT NOT NULL,
      result TEXT NOT NULL,
      note TEXT NOT NULL
    );
  `);
}

async function migratePasswordHashes(client: PoolClient) {
  const result = await client.query<{ id: string; password: string; password_hash: string | null }>(
    "SELECT id, password, password_hash FROM login_accounts",
  );

  for (const row of result.rows) {
    if (row.password_hash) {
      continue;
    }

    const passwordHash = hashPassword(row.password || "123456");
    await client.query("UPDATE login_accounts SET password_hash = $1 WHERE id = $2", [passwordHash, row.id]);
  }
}

async function seedIfEmpty(client: PoolClient) {
  const existing = await client.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM tenants");
  if (Number(existing.rows[0]?.count ?? 0) > 0) {
    return;
  }

  await client.query(`
    INSERT INTO tenants (id, name, code, industry, contact_name, contact_phone, status, created_at, note) VALUES
    ('tenant-huaxing', '鍗庢槦鍒堕€?, 'HX-001', '鍒堕€犱笟', '闄堝織杩?, '13800110001', '鍚敤', '2026-01-08', '宸叉帴鍏?2 涓巶鍖猴紝鍚庣画璁″垝鎺ュ叆缁翠繚妯″潡銆?),
    ('tenant-anhe', '瀹夊拰鍟嗕笟涓績', 'AH-002', '鍟嗕笟缁煎悎浣?, '鍒樻檽鏁?, '13800110002', '鍚敤', '2026-02-15', '閲嶇偣鍏虫敞鎶ヨ涓績涓庡ぇ灞忔€佸娍銆?)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO plans (id, name, code, status, price_monthly, max_devices, max_users, sms_quota, feature_keys, description) VALUES
    ('plan-basic', '鍩虹鐗?, 'basic', '鍚敤', 1999, 100, 20, 500, '["dashboard","alarm_center","device_management","user_management","settings"]'::jsonb, '閫傚悎涓皬鍨嬩紒涓氾紝瑕嗙洊鍩虹鐩戞帶銆佹姤璀︿笌璁惧绠＄悊鑳藉姏銆?),
    ('plan-pro', '涓撲笟鐗?, 'pro', '鍚敤', 4999, 500, 80, 3000, '["dashboard","alarm_center","device_management","user_management","settings","advanced_reports","maintenance"]'::jsonb, '鎻愪緵楂樼骇鎶ヨ〃涓庡贰妫€缁翠繚锛岄€傚悎澶氬洯鍖恒€佸鐝粍浼佷笟銆?),
    ('plan-enterprise', '浼佷笟鐗?, 'enterprise', '鍚敤', 9999, 2000, 300, 12000, '["dashboard","alarm_center","device_management","user_management","settings","advanced_reports","maintenance","api_access"]'::jsonb, '闈㈠悜闆嗗洟瀹㈡埛锛屾彁渚?API 瀵规帴涓庨珮閰嶉鑳藉姏銆?)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO subscriptions (id, tenant_id, plan_id, status, start_date, end_date, trial, auto_renew) VALUES
    ('sub-1', 'tenant-huaxing', 'plan-enterprise', '宸茬敓鏁?, '2026-01-10', '2027-01-09', false, true),
    ('sub-2', 'tenant-anhe', 'plan-pro', '璇曠敤涓?, '2026-04-01', '2026-05-01', true, false)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO platform_users (id, username, phone, role_key, status, note) VALUES
    ('platform-user-1', 'super.admin', '13900110001', 'platform_super_admin', '鍚敤', '骞冲彴鍞竴瓒呯骇绠＄悊鍛樿处鍙枫€?)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO tenant_users (id, tenant_id, username, phone, role_key, status, sms_enabled, message_types, note) VALUES
    ('tenant-user-1', 'tenant-huaxing', 'hx_admin', '13700000001', 'tenant_level_1', '鍚敤', true, '["鎶ヨ淇℃伅","鏁呴殰淇℃伅"]'::jsonb, '鍗庢槦鍒堕€犳€诲€肩彮璐熻矗浜恒€?),
    ('tenant-user-2', 'tenant-huaxing', 'hx_duty', '13700000002', 'tenant_level_2', '鍚敤', true, '["鎶ヨ淇℃伅"]'::jsonb, '鍗庢槦鍒堕€犱腑鎺у鍊肩彮鍛樸€?),
    ('tenant-user-3', 'tenant-anhe', 'ah_admin', '13700000003', 'tenant_level_1', '鍚敤', true, '["鎶ヨ淇℃伅","鏁呴殰淇℃伅"]'::jsonb, '瀹夊拰鍟嗕笟涓績绠＄悊鍛樸€?)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO login_accounts (id, username, password, password_hash, display_name, scope, role_key, tenant_id, must_change_password) VALUES
    ('account-platform-1', 'platform_admin', '', '${hashPassword("Admin123456")}', '骞冲彴瓒呯骇绠＄悊鍛?, 'platform', 'platform_super_admin', NULL, false),
    ('account-tenant-hx-1', 'hx_admin', '', '${hashPassword("Hx123456")}', '鍗庢槦鍒堕€犵鐞嗗憳', 'tenant', 'tenant_level_1', 'tenant-huaxing', true),
    ('account-tenant-ah-1', 'ah_admin', '', '${hashPassword("Ah123456")}', '瀹夊拰鍟嗕笟涓績绠＄悊鍛?, 'tenant', 'tenant_level_1', 'tenant-anhe', true)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO tenant_devices (id, tenant_id, name, type, area, installation_location, status, last_report_at, notes) VALUES
    ('device-hx-1', 'tenant-huaxing', '1鍙峰巶鎴跨儫鎰?A-101', '鐑熼浘鎺㈡祴鍣?, '1鍙峰巶鎴?, '涓滀晶閰嶇數鍖?, '鎶ヨ', '2026-04-20 09:12:45', '浠婃棩 09:12 瑙﹀彂鐑熼浘鎶ヨ锛岀瓑寰呯幇鍦烘牳鏌ャ€?),
    ('device-hx-2', 'tenant-huaxing', '鍠锋穻鑱斿姩妯″潡 A-208', '鑱斿姩鎺у埗妯″潡', '2鍙峰巶鎴?, '涓昏蛋寤?, '姝ｅ父', '2026-04-20 09:03:11', '杩愯绋冲畾銆?),
    ('device-hx-3', 'tenant-huaxing', '娑堥槻娉靛帇鍔涚洃娴?A-301', '姘村帇鐩戞祴鍣?, '娉垫埧', '鍖椾晶娉垫埧', '鏁呴殰', '2026-04-20 08:55:10', '璁惧鑷寮傚父锛屽緟缁存姢銆?),
    ('device-ah-1', 'tenant-anhe', '涓涵鐑熸劅 B-101', '鐑熼浘鎺㈡祴鍣?, '鍟嗕笟涓涵', '涓€灞備腑搴?, '姝ｅ父', '2026-04-20 09:05:12', '鐘舵€佹甯搞€?),
    ('device-ah-2', 'tenant-anhe', '鍦颁笅杞﹀簱鎵嬫姤 B-204', '鎵嬪姩鎶ヨ鎸夐挳', '鍦颁笅杞﹀簱', 'B2 鐢垫鍓嶅', '绂荤嚎', '2026-04-20 07:18:20', '缃戠粶閾捐矾涓柇銆?)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO tenant_alarms (id, tenant_id, device_id, device_name, location, alarm_type, time, process_status) VALUES
    ('alarm-hx-1', 'tenant-huaxing', 'device-hx-1', '1鍙峰巶鎴跨儫鎰?A-101', '1鍙峰巶鎴?/ 涓滀晶閰嶇數鍖?, '鐑熸劅瑙﹀彂鎶ヨ', '2026-04-20 09:12:45', '鏈鐞?),
    ('alarm-hx-2', 'tenant-huaxing', 'device-hx-3', '娑堥槻娉靛帇鍔涚洃娴?A-301', '娉垫埧 / 鍖椾晶娉垫埧', '鏁呴殰鎶ヨ', '2026-04-20 08:55:10', '澶勭悊涓?),
    ('alarm-ah-1', 'tenant-anhe', 'device-ah-2', '鍦颁笅杞﹀簱鎵嬫姤 B-204', '鍦颁笅杞﹀簱 / B2 鐢垫鍓嶅', '璁惧绂荤嚎', '2026-04-20 07:18:20', '鏈鐞?)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO notification_settings (id, tenant_id, alarm_threshold, notification_enabled, map_placeholder, remark) VALUES
    ('notify-hx', 'tenant-huaxing', '鐑熼浘娴撳害 > 75 ppm', true, '鍗庢槦鍒堕€犲洯鍖烘€诲浘 V1', '鐭俊閫氱煡鍙戦€佸埌鎬诲€肩彮璐熻矗浜哄拰宸℃涓荤銆?),
    ('notify-ah', 'tenant-anhe', '鐑熸劅杩炵画 10 绉掕Е鍙戞姤璀?, true, '瀹夊拰鍟嗕笟涓績妤煎眰鍥?V3', '鍟嗕笟涓涵涓庤溅搴撲负閲嶇偣鍏虫敞鍖哄煙銆?)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO quota_usage (id, tenant_id, device_count, user_count, sms_used) VALUES
      ('quota-hx', 'tenant-huaxing', 328, 34, 980),
      ('quota-ah', 'tenant-anhe', 146, 18, 420)
      ON CONFLICT (id) DO NOTHING;

    INSERT INTO notification_templates (id, tenant_id, name, channel, level, target_roles, template_text, enabled, created_at, updated_at) VALUES
      ('template-hx-alarm-sms', 'tenant-huaxing', '火警短信通知', 'sms', 'alarm', '["tenant_level_1","tenant_level_2"]'::jsonb, '【火警报警】{{content}}，请立即核查。', true, '2026-04-20 08:00:00', '2026-04-20 08:00:00'),
      ('template-hx-fault-inapp', 'tenant-huaxing', '故障站内通知', 'in_app', 'fault', '["tenant_level_1","tenant_level_3"]'::jsonb, '【设备故障】{{content}}，请尽快处理。', true, '2026-04-20 08:00:00', '2026-04-20 08:00:00'),
      ('template-ah-alarm-sms', 'tenant-anhe', '商场火警短信通知', 'sms', 'alarm', '["tenant_level_1","tenant_level_2"]'::jsonb, '【火警报警】{{content}}，请值班人员立即到场。', true, '2026-04-20 08:00:00', '2026-04-20 08:00:00'),
      ('template-ah-fault-inapp', 'tenant-anhe', '商场故障站内通知', 'in_app', 'fault', '["tenant_level_1","tenant_level_3"]'::jsonb, '【设备故障】{{content}}，请安排维保。', true, '2026-04-20 08:00:00', '2026-04-20 08:00:00')
      ON CONFLICT (id) DO NOTHING;

    INSERT INTO audit_logs (id, tenant_id, actor_scope, actor_name, actor_role, action, target_type, target_id, result, detail, created_at) VALUES
      ('audit-seed-1', 'tenant-huaxing', 'tenant', 'hx_admin', 'tenant_level_1', 'system.seed', 'tenant', 'tenant-huaxing', 'success', '初始化企业基础数据', '2026-04-20 08:05:00'),
      ('audit-seed-2', 'tenant-anhe', 'tenant', 'ah_admin', 'tenant_level_1', 'system.seed', 'tenant', 'tenant-anhe', 'success', '初始化企业基础数据', '2026-04-20 08:05:00')
      ON CONFLICT (id) DO NOTHING;
    `);
  }

async function seedSpatialFoundation(client: PoolClient) {
  const existing = await client.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM tenant_sites");
  if (Number(existing.rows[0]?.count ?? 0) > 0) {
    return;
  }

  await client.query(`
    INSERT INTO tenant_sites (id, tenant_id, name, code, address, status, description) VALUES
    ('site-hx-main', 'tenant-huaxing', '华星制造主园区', 'HX-SITE-01', '苏州工业园区金石路18号', 'active', '企业主生产园区，包含厂房与消防泵房'),
    ('site-ah-mall', 'tenant-anhe', '安和商业中心', 'AH-SITE-01', '杭州安和大道88号', 'active', '商业综合体场景，重点区域为中庭、地下车库和配电房')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO tenant_buildings (id, tenant_id, site_id, name, code, level_count, usage_type) VALUES
    ('building-hx-a', 'tenant-huaxing', 'site-hx-main', '1号厂房', 'HX-A', 3, '制造车间'),
    ('building-hx-pump', 'tenant-huaxing', 'site-hx-main', '娑堥槻娉垫埧', 'HX-P', 1, '鍔ㄥ姏淇濋殰'),
    ('building-ah-main', 'tenant-anhe', 'site-ah-mall', '商业主楼', 'AH-MAIN', 5, '商业综合体'),
    ('building-ah-garage', 'tenant-anhe', 'site-ah-mall', '地下车库', 'AH-GARAGE', 2, '停车与设备用房')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO tenant_floors (id, tenant_id, building_id, name, code, level_index, description) VALUES
    ('floor-hx-a-1', 'tenant-huaxing', 'building-hx-a', '1层', 'HX-A-1', 1, '东侧配电区与原料缓冲区'),
    ('floor-hx-a-2', 'tenant-huaxing', 'building-hx-a', '2层', 'HX-A-2', 2, '联动模块与工艺走廊'),
    ('floor-hx-p-1', 'tenant-huaxing', 'building-hx-pump', '泵房层', 'HX-P-1', 1, '消防泵与稳压设备'),
    ('floor-ah-main-1', 'tenant-anhe', 'building-ah-main', '1层中庭', 'AH-M-1', 1, '中庭、商铺入口与疏散通道'),
    ('floor-ah-g-2', 'tenant-anhe', 'building-ah-garage', 'B2车库', 'AH-G-B2', -2, '地下车库与电梯前室')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO tenant_drawings (id, tenant_id, floor_id, name, file_url, width, height, version, status, updated_at) VALUES
    ('drawing-hx-a-1', 'tenant-huaxing', 'floor-hx-a-1', '1号厂房1层总图', '/drawings/hx-a-1.png', 1600, 900, 'v1.0', 'published', '2026-04-18 10:20:00'),
    ('drawing-hx-a-2', 'tenant-huaxing', 'floor-hx-a-2', '1号厂房2层联动图', '/drawings/hx-a-2.png', 1600, 900, 'v1.0', 'published', '2026-04-18 10:26:00'),
    ('drawing-hx-p-1', 'tenant-huaxing', 'floor-hx-p-1', '泵房布置图', '/drawings/hx-p-1.png', 1200, 720, 'v0.9', 'draft', '2026-04-19 08:15:00'),
    ('drawing-ah-main-1', 'tenant-anhe', 'floor-ah-main-1', '商业主楼1层消防图', '/drawings/ah-main-1.png', 1800, 1080, 'v1.2', 'published', '2026-04-17 17:40:00'),
    ('drawing-ah-g-2', 'tenant-anhe', 'floor-ah-g-2', 'B2车库消防总图', '/drawings/ah-g-b2.png', 1800, 1080, 'v1.1', 'published', '2026-04-16 14:05:00')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO tenant_gateways (id, tenant_id, site_id, name, protocol, serial_number, status, last_seen_at) VALUES
    ('gateway-hx-1', 'tenant-huaxing', 'site-hx-main', '华星园区采集网关1', 'MQTT', 'HXGW-202604-001', 'online', '2026-04-22 15:18:00'),
    ('gateway-hx-2', 'tenant-huaxing', 'site-hx-main', '泵房边缘网关', 'Modbus TCP', 'HXGW-202604-002', 'fault', '2026-04-22 14:51:00'),
    ('gateway-ah-1', 'tenant-anhe', 'site-ah-mall', '商业中心边缘网关', 'MQTT', 'AHGW-202604-001', 'online', '2026-04-22 15:16:00')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO tenant_device_points (id, tenant_id, device_id, floor_id, drawing_id, x, y, rotation, icon, status_style, updated_at) VALUES
    ('point-hx-1', 'tenant-huaxing', 'device-hx-1', 'floor-hx-a-1', 'drawing-hx-a-1', 0.72, 0.28, 0, 'smoke', 'alarm', '2026-04-22 15:05:00'),
    ('point-hx-2', 'tenant-huaxing', 'device-hx-2', 'floor-hx-a-2', 'drawing-hx-a-2', 0.45, 0.48, 0, 'module', 'normal', '2026-04-22 15:00:00'),
    ('point-hx-3', 'tenant-huaxing', 'device-hx-3', 'floor-hx-p-1', 'drawing-hx-p-1', 0.36, 0.58, 0, 'pressure', 'fault', '2026-04-22 14:52:00'),
    ('point-ah-1', 'tenant-anhe', 'device-ah-1', 'floor-ah-main-1', 'drawing-ah-main-1', 0.51, 0.35, 0, 'smoke', 'normal', '2026-04-22 15:08:00'),
    ('point-ah-2', 'tenant-anhe', 'device-ah-2', 'floor-ah-g-2', 'drawing-ah-g-2', 0.68, 0.62, 0, 'button', 'offline', '2026-04-22 14:40:00')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO raw_device_events (id, tenant_id, device_id, gateway_id, event_type, event_code, event_level, payload, reported_at) VALUES
    ('event-hx-1', 'tenant-huaxing', 'device-hx-1', 'gateway-hx-1', 'alarm', 'SMOKE_HIGH', 'critical', '{"smokeDensity": 86, "unit": "ppm"}'::jsonb, '2026-04-22 15:05:12'),
    ('event-hx-2', 'tenant-huaxing', 'device-hx-3', 'gateway-hx-2', 'fault', 'PRESSURE_SENSOR_FAULT', 'warning', '{"pressure": 0.12, "unit": "MPa"}'::jsonb, '2026-04-22 14:51:33'),
    ('event-hx-3', 'tenant-huaxing', 'device-hx-2', 'gateway-hx-1', 'heartbeat', 'HEARTBEAT_OK', 'info', '{"latencyMs": 42}'::jsonb, '2026-04-22 15:04:10'),
    ('event-ah-1', 'tenant-anhe', 'device-ah-2', 'gateway-ah-1', 'status_change', 'DEVICE_OFFLINE', 'warning', '{"offlineMinutes": 37}'::jsonb, '2026-04-22 14:40:08'),
    ('event-ah-2', 'tenant-anhe', 'device-ah-1', 'gateway-ah-1', 'heartbeat', 'HEARTBEAT_OK', 'info', '{"latencyMs": 28}'::jsonb, '2026-04-22 15:07:41')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO device_status_snapshots (device_id, tenant_id, gateway_id, status, last_event_type, last_event_code, last_reported_at, updated_at) VALUES
    ('device-hx-1', 'tenant-huaxing', 'gateway-hx-1', 'alarm', 'alarm', 'SMOKE_HIGH', '2026-04-22 15:05:12', '2026-04-22 15:05:12'),
    ('device-hx-2', 'tenant-huaxing', 'gateway-hx-1', 'normal', 'heartbeat', 'HEARTBEAT_OK', '2026-04-22 15:04:10', '2026-04-22 15:04:10'),
    ('device-hx-3', 'tenant-huaxing', 'gateway-hx-2', 'fault', 'fault', 'PRESSURE_SENSOR_FAULT', '2026-04-22 14:51:33', '2026-04-22 14:51:33'),
    ('device-ah-1', 'tenant-anhe', 'gateway-ah-1', 'normal', 'heartbeat', 'HEARTBEAT_OK', '2026-04-22 15:07:41', '2026-04-22 15:07:41'),
    ('device-ah-2', 'tenant-anhe', 'gateway-ah-1', 'offline', 'status_change', 'DEVICE_OFFLINE', '2026-04-22 14:40:08', '2026-04-22 14:40:08')
    ON CONFLICT (device_id) DO NOTHING;

    UPDATE tenant_devices SET
      site_id = 'site-hx-main',
      building_id = 'building-hx-a',
      floor_id = CASE
        WHEN id = 'device-hx-1' THEN 'floor-hx-a-1'
        WHEN id = 'device-hx-2' THEN 'floor-hx-a-2'
        WHEN id = 'device-hx-3' THEN 'floor-hx-p-1'
        ELSE floor_id
      END,
      gateway_id = CASE
        WHEN id IN ('device-hx-1', 'device-hx-2') THEN 'gateway-hx-1'
        WHEN id = 'device-hx-3' THEN 'gateway-hx-2'
        ELSE gateway_id
      END,
      model_code = CASE
        WHEN id = 'device-hx-1' THEN 'SMK-200'
        WHEN id = 'device-hx-2' THEN 'CTRL-420'
        WHEN id = 'device-hx-3' THEN 'PRS-310'
        ELSE model_code
      END,
      protocol_type = CASE
        WHEN id = 'device-hx-3' THEN 'Modbus'
        ELSE 'MQTT'
      END,
      serial_number = CASE
        WHEN id = 'device-hx-1' THEN 'HX-SMK-0001'
        WHEN id = 'device-hx-2' THEN 'HX-CTRL-0008'
        WHEN id = 'device-hx-3' THEN 'HX-PRS-0011'
        ELSE serial_number
      END
    WHERE tenant_id = 'tenant-huaxing';

    UPDATE tenant_devices SET
      site_id = 'site-ah-mall',
      building_id = CASE
        WHEN id = 'device-ah-1' THEN 'building-ah-main'
        WHEN id = 'device-ah-2' THEN 'building-ah-garage'
        ELSE building_id
      END,
      floor_id = CASE
        WHEN id = 'device-ah-1' THEN 'floor-ah-main-1'
        WHEN id = 'device-ah-2' THEN 'floor-ah-g-2'
        ELSE floor_id
      END,
      gateway_id = 'gateway-ah-1',
      model_code = CASE
        WHEN id = 'device-ah-1' THEN 'SMK-200'
        WHEN id = 'device-ah-2' THEN 'BTN-110'
        ELSE model_code
      END,
      protocol_type = 'MQTT',
      serial_number = CASE
        WHEN id = 'device-ah-1' THEN 'AH-SMK-0021'
        WHEN id = 'device-ah-2' THEN 'AH-BTN-0034'
        ELSE serial_number
      END
    WHERE tenant_id = 'tenant-anhe';
  `);
}

async function seedOperationalDefaults(client: PoolClient) {
  await client.query(
    `UPDATE tenant_alarms
     SET workflow_status = CASE
       WHEN process_status IN ('处理中', '婢跺嫮鎮婃稉?') THEN '处理中'
       WHEN process_status IN ('已处理', '瀹告彃顦╅悶?') THEN '已完成'
       ELSE '未处理'
     END
     WHERE workflow_status IS NULL OR workflow_status = '' OR workflow_status = '未处理' OR workflow_status = '处理中' OR workflow_status = '已完成'`
  );

  await client.query(`
    INSERT INTO notification_templates (id, tenant_id, name, channel, level, target_roles, template_text, enabled, created_at, updated_at) VALUES
      ('template-hx-alarm-sms', 'tenant-huaxing', '火警短信通知', 'sms', 'alarm', '["tenant_level_1","tenant_level_2"]'::jsonb, '【火警报警】{{content}}，请立即核查。', true, '2026-04-20 08:00:00', '2026-04-20 08:00:00'),
      ('template-hx-fault-inapp', 'tenant-huaxing', '故障站内通知', 'in_app', 'fault', '["tenant_level_1","tenant_level_3"]'::jsonb, '【设备故障】{{content}}，请尽快处理。', true, '2026-04-20 08:00:00', '2026-04-20 08:00:00'),
      ('template-ah-alarm-sms', 'tenant-anhe', '商场火警短信通知', 'sms', 'alarm', '["tenant_level_1","tenant_level_2"]'::jsonb, '【火警报警】{{content}}，请值班人员立即到场。', true, '2026-04-20 08:00:00', '2026-04-20 08:00:00'),
      ('template-ah-fault-inapp', 'tenant-anhe', '商场故障站内通知', 'in_app', 'fault', '["tenant_level_1","tenant_level_3"]'::jsonb, '【设备故障】{{content}}，请安排维保。', true, '2026-04-20 08:00:00', '2026-04-20 08:00:00')
    ON CONFLICT (id) DO NOTHING;
  `);

  await client.query(`
    INSERT INTO duty_shifts (id, tenant_id, name, start_time, end_time, is_default) VALUES
      ('shift-hx-morning', 'tenant-huaxing', '早班', '08:00', '16:00', true),
      ('shift-hx-evening', 'tenant-huaxing', '中班', '16:00', '00:00', true),
      ('shift-hx-night', 'tenant-huaxing', '晚班', '00:00', '08:00', true),
      ('shift-ah-morning', 'tenant-anhe', '早班', '08:00', '16:00', true),
      ('shift-ah-evening', 'tenant-anhe', '中班', '16:00', '00:00', true),
      ('shift-ah-night', 'tenant-anhe', '晚班', '00:00', '08:00', true)
    ON CONFLICT (id) DO NOTHING;
  `);

  await client.query(`
    INSERT INTO duty_schedules (id, tenant_id, duty_date, shift_id, assignee_name, assignee_phone, assigned_by, status, started_at, ended_at, handover_note) VALUES
      ('schedule-hx-2026-04-23-morning', 'tenant-huaxing', '2026-04-23', 'shift-hx-morning', '华星白班值守', '13700000001', 'platform_admin', 'scheduled', NULL, NULL, ''),
      ('schedule-hx-2026-04-23-evening', 'tenant-huaxing', '2026-04-23', 'shift-hx-evening', '华星中班值守', '13700000002', 'platform_admin', 'scheduled', NULL, NULL, ''),
      ('schedule-ah-2026-04-23-morning', 'tenant-anhe', '2026-04-23', 'shift-ah-morning', '安和白班值守', '13700000003', 'platform_admin', 'scheduled', NULL, NULL, '')
    ON CONFLICT (id) DO NOTHING;
  `);

  await client.query(`
    INSERT INTO duty_logs (id, tenant_id, schedule_id, log_type, content, operator_name, created_at) VALUES
      ('duty-log-hx-1', 'tenant-huaxing', 'schedule-hx-2026-04-23-morning', 'shift_action', '已生成今日值班排班', 'system', '2026-04-23 00:00:00'),
      ('duty-log-ah-1', 'tenant-anhe', 'schedule-ah-2026-04-23-morning', 'shift_action', '已生成今日值班排班', 'system', '2026-04-23 00:00:00')
    ON CONFLICT (id) DO NOTHING;
  `);

  await client.query(`
    INSERT INTO inspection_tasks (id, tenant_id, title, plan_type, target_type, target_id, target_name, due_date, assigned_to, status, note, created_at) VALUES
      ('inspect-hx-1', 'tenant-huaxing', '1号厂房烟感日巡检', 'daily', 'device', 'device-hx-1', '1号厂房烟感 A-101', '2026-04-23', 'hx_admin', 'pending', '重点关注火警探测器采样状态', '2026-04-22 18:00:00'),
      ('inspect-ah-1', 'tenant-anhe', 'B2 车库周巡检', 'weekly', 'area', 'floor-ah-g-2', 'B2 车库', '2026-04-23', 'ah_admin', 'pending', '检查离线手报与疏散通道设施', '2026-04-22 18:00:00')
    ON CONFLICT (id) DO NOTHING;
  `);

  await client.query(`
    INSERT INTO maintenance_records (id, tenant_id, device_id, device_name, vendor_name, maintenance_date, next_due_date, result, note) VALUES
      ('maint-hx-1', 'tenant-huaxing', 'device-hx-3', '消防泵压力监测 A-301', '苏州维保中心', '2026-04-10', '2026-05-10', '待复检', '压力传感器更换后待验证'),
      ('maint-ah-1', 'tenant-anhe', 'device-ah-2', '地下车库手报 B-204', '杭州维保站', '2026-04-08', '2026-05-08', '处理中', '排查离线线路与模块状态')
    ON CONFLICT (id) DO NOTHING;
  `);
}

export async function ensureDatabase() {
  if (!globalThis.__smartFirePgInitPromise) {
    globalThis.__smartFirePgInitPromise = withClient(async (client) => {
      await client.query("BEGIN");
      try {
        await createSchema(client);
        await seedIfEmpty(client);
        await seedSpatialFoundation(client);
        await seedOperationalDefaults(client);
        await migratePasswordHashes(client);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    });
  }

  return globalThis.__smartFirePgInitPromise;
}

export async function queryReady<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []) {
  await ensureDatabase();
  return query<T>(sql, params);
}

export async function getReady<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []) {
  const result = await queryReady<T>(sql, params);
  return result.rows[0];
}

export async function allReady<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []) {
  const result = await queryReady<T>(sql, params);
  return result.rows;
}

function fromJsonArray(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeStatusText(value: string) {
  const text = String(value ?? "");
  const map: Record<string, string> = {
    "濮濓絽鐖?": "正常",
    "閹躲儴顒?": "报警",
    "閺佸懘娈?": "故障",
    "缁傝崵鍤?": "离线",
    "缂佺繝鎱ㄦ稉?": "维修中",
    "閸氼垳鏁?": "启用",
    "閸嬫粎鏁?": "停用",
    "閺堫亜顦╅悶?": "未处理",
    "婢跺嫮鎮婃稉?": "处理中",
    "瀹告彃顦╅悶?": "已处理",
    "鐠囨洜鏁ゆ稉?": "试用中",
    "瀹歌尙鏁撻弫?": "已生效",
    "瀹歌尪绻冮張?": "已过期",
    "瀹告彃浠犻悽?": "已停用",
    "閹躲儴顒熸穱鈩冧紖": "鎶ヨ淇℃伅",
    "閺佸懘娈版穱鈩冧紖": "故障信息",
  };

  return map[text] ?? text;
}

function normalizeAlarmTypeText(value: string) {
  const text = String(value ?? "");

  if (text.includes("鐏") || text.includes("火警")) {
    return "火警报警";
  }
  if (text.includes("鏁呴殰") || text.includes("故障")) {
    return "设备故障";
  }
  if (text.includes("绂荤嚎") || text.includes("离线")) {
    return "设备离线";
  }
  if (text.includes("鎭㈠") || text.includes("恢复")) {
    return "设备恢复";
  }
  if (text.includes("蹇冭烦") || text.includes("心跳")) {
    return "设备心跳";
  }

  return text;
}

function normalizeWorkflowStatus(value: string): AlarmWorkflowStatus {
  const text = normalizeStatusText(String(value ?? ""));
  if (text === "已确认") return "已确认";
  if (text === "处理中") return "处理中";
  if (text === "已完成") return "已完成";
  if (text === "已关闭") return "已关闭";
  return "未处理";
}

function jsonStringArray(value: unknown) {
  return fromJsonArray(value).map((item) => String(item));
}

function mapTenant(row: any) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    industry: row.industry,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    status: normalizeStatusText(row.status) as TenantRecord["status"],
    createdAt: row.created_at,
    note: row.note,
  };
}

function mapPlan(row: any) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    status: normalizeStatusText(row.status) as PlanRecord["status"],
    priceMonthly: Number(row.price_monthly),
    maxDevices: Number(row.max_devices),
    maxUsers: Number(row.max_users),
    smsQuota: Number(row.sms_quota),
    featureKeys: fromJsonArray(row.feature_keys),
    description: row.description,
  };
}

function mapSubscription(row: any) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    planId: row.plan_id,
    status: normalizeStatusText(row.status) as SubscriptionRecord["status"],
    startDate: row.start_date,
    endDate: row.end_date,
    trial: Boolean(row.trial),
    autoRenew: Boolean(row.auto_renew),
  };
}

function mapPlatformUser(row: any) {
  return {
    id: row.id,
    username: row.username,
    phone: row.phone,
    roleKey: row.role_key,
    status: normalizeStatusText(row.status) as PlatformUserRecord["status"],
    note: row.note,
  };
}

function mapTenantUser(row: any) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    username: row.username,
    phone: row.phone,
    roleKey: row.role_key,
    status: normalizeStatusText(row.status) as TenantUserRecord["status"],
    smsEnabled: Boolean(row.sms_enabled),
    messageTypes: fromJsonArray(row.message_types).map((item) => normalizeStatusText(item) as TenantUserRecord["messageTypes"][number]),
    note: row.note,
  };
}

function mapTenantDevice(row: any) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    type: row.type,
    area: row.area,
    installationLocation: row.installation_location,
    status: normalizeStatusText(row.status) as TenantDeviceRecord["status"],
    lastReportAt: row.last_report_at,
    notes: row.notes,
    siteId: row.site_id ?? undefined,
    buildingId: row.building_id ?? undefined,
    floorId: row.floor_id ?? undefined,
    gatewayId: row.gateway_id ?? undefined,
    modelCode: row.model_code ?? "",
    protocolType: row.protocol_type ?? "",
    serialNumber: row.serial_number ?? "",
    location: `${row.area} / ${row.installation_location}`,
  };
}

function mapAlarm(row: any) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    deviceId: row.device_id,
    deviceName: row.device_name,
    location: row.location,
    alarmType: normalizeAlarmTypeText(row.alarm_type),
    time: row.time,
    processStatus: normalizeStatusText(row.process_status) as TenantAlarmRecord["processStatus"],
  };
}

function mapAlarmTimeline(row: any): AlarmTimelineEntry {
  return {
    id: row.id,
    action: row.action,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    operatorName: row.operator_name,
    operatorRole: row.operator_role,
    note: row.note,
    attachments: jsonStringArray(row.attachments),
    createdAt: row.created_at,
  };
}

function mapNotificationTemplate(row: any): NotificationTemplateRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    channel: row.channel,
    level: row.level,
    targetRoles: jsonStringArray(row.target_roles),
    templateText: row.template_text,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapNotificationRecord(row: any): NotificationRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    alarmId: row.alarm_id ?? undefined,
    templateId: row.template_id ?? undefined,
    channel: row.channel,
    level: row.level,
    targetName: row.target_name,
    content: row.content,
    status: row.status,
    retryCount: Number(row.retry_count),
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAuditLog(row: any): AuditLogRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id ?? undefined,
    actorScope: row.actor_scope,
    actorName: row.actor_name,
    actorRole: row.actor_role,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    result: row.result,
    detail: row.detail,
    createdAt: row.created_at,
  };
}

function mapDutyShift(row: any): DutyShiftRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    startTime: row.start_time,
    endTime: row.end_time,
    isDefault: Boolean(row.is_default),
  };
}

function mapDutySchedule(row: any, shifts: DutyShiftRecord[]): DutyScheduleRecord {
  const shift = shifts.find((item) => item.id === row.shift_id);
  return {
    id: row.id,
    tenantId: row.tenant_id,
    dutyDate: row.duty_date,
    shiftId: row.shift_id,
    shiftName: shift?.name ?? row.shift_id,
    shiftStartTime: shift?.startTime ?? "",
    shiftEndTime: shift?.endTime ?? "",
    assigneeName: row.assignee_name,
    assigneePhone: row.assignee_phone,
    assignedBy: row.assigned_by,
    status: row.status,
    startedAt: row.started_at ?? undefined,
    endedAt: row.ended_at ?? undefined,
    handoverNote: row.handover_note ?? "",
  };
}

function mapDutyLog(row: any): DutyLogRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    scheduleId: row.schedule_id ?? undefined,
    logType: row.log_type,
    content: row.content,
    operatorName: row.operator_name,
    createdAt: row.created_at,
  };
}

function mapInspectionTask(row: any): InspectionTaskRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    planType: row.plan_type,
    targetType: row.target_type,
    targetId: row.target_id,
    targetName: row.target_name,
    dueDate: row.due_date,
    assignedTo: row.assigned_to,
    status: row.status,
    note: row.note,
    createdAt: row.created_at,
  };
}

function mapInspectionRecord(row: any): InspectionRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    taskId: row.task_id,
    result: row.result,
    note: row.note,
    inspectedBy: row.inspected_by,
    inspectedAt: row.inspected_at,
  };
}

function mapIssue(row: any): IssueRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    title: row.title,
    level: row.level,
    status: row.status,
    note: row.note,
    rectificationDeadline: row.rectification_deadline ?? undefined,
    rectifiedAt: row.rectified_at ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    createdAt: row.created_at,
  };
}

function mapMaintenanceRecord(row: any): MaintenanceRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    deviceId: row.device_id,
    deviceName: row.device_name,
    vendorName: row.vendor_name,
    maintenanceDate: row.maintenance_date,
    nextDueDate: row.next_due_date,
    result: row.result,
    note: row.note,
  };
}

function mapNotification(row: any) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    alarmThreshold: row.alarm_threshold,
    notificationEnabled: Boolean(row.notification_enabled),
    mapPlaceholder: row.map_placeholder,
    remark: row.remark,
  };
}

function mapQuota(row: any) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    deviceCount: Number(row.device_count),
    userCount: Number(row.user_count),
    smsUsed: Number(row.sms_used),
  };
}

function mapSite(row: any): TenantSiteRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    code: row.code,
    address: row.address,
    status: row.status,
    description: row.description,
  };
}

function mapBuilding(row: any): TenantBuildingRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    siteId: row.site_id,
    name: row.name,
    code: row.code,
    levelCount: Number(row.level_count),
    usageType: row.usage_type,
  };
}

function mapFloor(row: any): TenantFloorRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    buildingId: row.building_id,
    name: row.name,
    code: row.code,
    levelIndex: Number(row.level_index),
    description: row.description,
  };
}

function mapDrawing(row: any): TenantDrawingRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    floorId: row.floor_id,
    name: row.name,
    fileUrl: row.file_url,
    width: Number(row.width),
    height: Number(row.height),
    version: row.version,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

function mapGateway(row: any): TenantGatewayRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    siteId: row.site_id,
    name: row.name,
    protocol: row.protocol,
    serialNumber: row.serial_number,
    status: row.status,
    lastSeenAt: row.last_seen_at,
  };
}

function mapDevicePoint(row: any): TenantDevicePointRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    deviceId: row.device_id,
    floorId: row.floor_id,
    drawingId: row.drawing_id,
    x: Number(row.x),
    y: Number(row.y),
    rotation: Number(row.rotation),
    icon: row.icon,
    statusStyle: row.status_style,
    updatedAt: row.updated_at,
  };
}

function mapRawDeviceEvent(row: any): RawDeviceEventRecord {
  const rawPayload = row.payload;
  const payload =
    rawPayload && typeof rawPayload === "object" ? (rawPayload as Record<string, unknown>) : ({} as Record<string, unknown>);

  return {
    id: row.id,
    tenantId: row.tenant_id,
    deviceId: row.device_id,
    gatewayId: row.gateway_id ?? undefined,
    eventType: row.event_type,
    eventCode: row.event_code,
    eventLevel: row.event_level,
    payload,
    reportedAt: row.reported_at,
  };
}

function mapDeviceStatusSnapshot(row: any): DeviceStatusSnapshotRecord {
  return {
    deviceId: row.device_id,
    tenantId: row.tenant_id,
    gatewayId: row.gateway_id ?? undefined,
    status: row.status,
    lastEventType: row.last_event_type,
    lastEventCode: row.last_event_code,
    lastReportedAt: row.last_reported_at,
    updatedAt: row.updated_at,
  };
}

export async function findLoginAccount(username: string, password: string) {
  const row = await getReady<any>("SELECT * FROM login_accounts WHERE username = $1 LIMIT 1", [username]);
  if (!row) {
    return null;
  }

  const passwordMatched =
    verifyPassword(password, row.password_hash) || (!!row.password && row.password === password);

  if (!passwordMatched) {
    return null;
  }

  if (!row.password_hash) {
    await queryReady("UPDATE login_accounts SET password_hash = $1 WHERE id = $2", [hashPassword(password), row.id]);
  }

  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    passwordHash: row.password_hash ?? undefined,
    scope: row.scope,
    roleKey: row.role_key,
    tenantId: row.tenant_id ?? undefined,
    mustChangePassword: Boolean(row.must_change_password),
  };
}

export async function updateLoginPassword(username: string, nextPassword: string) {
  const passwordHash = hashPassword(nextPassword);
  await queryReady(
    "UPDATE login_accounts SET password = '', password_hash = $1, must_change_password = FALSE WHERE username = $2",
    [passwordHash, username],
  );
}

export async function getTenantById(tenantId?: string) {
  if (!tenantId) {
    return null;
  }

  const row = await getReady<any>("SELECT * FROM tenants WHERE id = $1", [tenantId]);
  return row ? mapTenant(row) : null;
}

export async function getPlatformOverview() {
  return {
    tenants: (await allReady<any>("SELECT * FROM tenants ORDER BY created_at ASC")).map(mapTenant),
    plans: (await allReady<any>("SELECT * FROM plans ORDER BY name ASC")).map(mapPlan),
    subscriptions: (await allReady<any>("SELECT * FROM subscriptions ORDER BY start_date DESC")).map(mapSubscription),
    platformUsers: (await allReady<any>("SELECT * FROM platform_users ORDER BY username ASC")).map(mapPlatformUser),
  };
}

export async function getTenantOverview(tenantId: string) {
  const tenant = await getTenantById(tenantId);
  const subscriptionRow = await getReady<any>("SELECT * FROM subscriptions WHERE tenant_id = $1 LIMIT 1", [tenantId]);
  const subscription = subscriptionRow ? mapSubscription(subscriptionRow) : null;
  const planRow =
    subscription ? await getReady<any>("SELECT * FROM plans WHERE id = $1 LIMIT 1", [subscription.planId]) : undefined;
  const settingsRow = await getReady<any>("SELECT * FROM notification_settings WHERE tenant_id = $1 LIMIT 1", [tenantId]);
  const quotaRow = await getReady<any>("SELECT * FROM quota_usage WHERE tenant_id = $1 LIMIT 1", [tenantId]);

  return {
    tenant,
    subscription,
    plan: planRow ? mapPlan(planRow) : null,
    devices: (await allReady<any>("SELECT * FROM tenant_devices WHERE tenant_id = $1 ORDER BY name ASC", [tenantId])).map(
      mapTenantDevice,
    ),
    alarms: (await allReady<any>("SELECT * FROM tenant_alarms WHERE tenant_id = $1 ORDER BY time DESC", [tenantId])).map(
      mapAlarm,
    ),
    users: (await allReady<any>("SELECT * FROM tenant_users WHERE tenant_id = $1 ORDER BY username ASC", [tenantId])).map(
      mapTenantUser,
    ),
    settings: settingsRow ? mapNotification(settingsRow) : null,
    quota: quotaRow ? mapQuota(quotaRow) : null,
  };
}

export async function getTenantSpatialModel(tenantId: string): Promise<TenantSpatialModel> {
  const [sites, buildings, floors, drawings, gateways, devicePoints, statusSnapshots, recentEvents, devices] =
    await Promise.all([
      allReady<any>("SELECT * FROM tenant_sites WHERE tenant_id = $1 ORDER BY name ASC", [tenantId]),
      allReady<any>("SELECT * FROM tenant_buildings WHERE tenant_id = $1 ORDER BY name ASC", [tenantId]),
      allReady<any>("SELECT * FROM tenant_floors WHERE tenant_id = $1 ORDER BY level_index ASC", [tenantId]),
      allReady<any>("SELECT * FROM tenant_drawings WHERE tenant_id = $1 ORDER BY updated_at DESC", [tenantId]),
      allReady<any>("SELECT * FROM tenant_gateways WHERE tenant_id = $1 ORDER BY name ASC", [tenantId]),
      allReady<any>("SELECT * FROM tenant_device_points WHERE tenant_id = $1 ORDER BY updated_at DESC", [tenantId]),
      allReady<any>("SELECT * FROM device_status_snapshots WHERE tenant_id = $1 ORDER BY updated_at DESC", [tenantId]),
      allReady<any>("SELECT * FROM raw_device_events WHERE tenant_id = $1 ORDER BY reported_at DESC LIMIT 12", [tenantId]),
      allReady<any>("SELECT id FROM tenant_devices WHERE tenant_id = $1", [tenantId]),
    ]);

  const totalDeviceCount = devices.length;
  const mappedDeviceCount = new Set(devicePoints.map((item) => item.device_id)).size;

  return {
    summary: {
      siteCount: sites.length,
      buildingCount: buildings.length,
      floorCount: floors.length,
      drawingCount: drawings.length,
      gatewayCount: gateways.length,
      onlineGatewayCount: gateways.filter((item) => item.status === "online").length,
      mappedDeviceCount,
      unmappedDeviceCount: Math.max(totalDeviceCount - mappedDeviceCount, 0),
      recentEventCount: recentEvents.length,
    },
    sites: sites.map(mapSite),
    buildings: buildings.map(mapBuilding),
    floors: floors.map(mapFloor),
    drawings: drawings.map(mapDrawing),
    gateways: gateways.map(mapGateway),
    devicePoints: devicePoints.map(mapDevicePoint),
    statusSnapshots: statusSnapshots.map(mapDeviceStatusSnapshot),
    recentEvents: recentEvents.map(mapRawDeviceEvent),
  };
}

export async function getTenantHistoryData(tenantId: string) {
  const [alarms, rawEvents, devices] = await Promise.all([
    allReady<any>("SELECT * FROM tenant_alarms WHERE tenant_id = $1 ORDER BY time DESC LIMIT 800", [tenantId]),
    allReady<any>("SELECT * FROM raw_device_events WHERE tenant_id = $1 ORDER BY reported_at DESC LIMIT 1500", [tenantId]),
    allReady<any>("SELECT * FROM tenant_devices WHERE tenant_id = $1 ORDER BY name ASC", [tenantId]),
  ]);

  return {
    alarms: alarms.map(mapAlarm),
    rawEvents: rawEvents.map(mapRawDeviceEvent),
    devices: devices.map(mapTenantDevice),
    exportedAt: formatLocalTimestamp(),
  };
}

async function insertAuditLog(client: PoolClient, input: Omit<AuditLogRecord, "id" | "createdAt"> & { createdAt?: string }) {
  const createdAt = input.createdAt ?? formatLocalTimestamp();
  await client.query(
    `INSERT INTO audit_logs (id, tenant_id, actor_scope, actor_name, actor_role, action, target_type, target_id, result, detail, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      input.tenantId ?? null,
      input.actorScope,
      input.actorName,
      input.actorRole,
      input.action,
      input.targetType,
      input.targetId,
      input.result,
      input.detail,
      createdAt,
    ],
  );
}

async function insertDutyLog(
  client: PoolClient,
  input: Omit<DutyLogRecord, "id" | "createdAt"> & { createdAt?: string },
) {
  const createdAt = input.createdAt ?? formatLocalTimestamp();
  await client.query(
    `INSERT INTO duty_logs (id, tenant_id, schedule_id, log_type, content, operator_name, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [createId("duty-log"), input.tenantId, input.scheduleId ?? null, input.logType, input.content, input.operatorName, createdAt],
  );
}

async function insertAlarmTimeline(
  client: PoolClient,
  input: Omit<AlarmTimelineEntry, "id" | "createdAt"> & { tenantId: string; alarmId: string; createdAt?: string },
) {
  const createdAt = input.createdAt ?? formatLocalTimestamp();
  await client.query(
    `INSERT INTO alarm_logs (id, tenant_id, alarm_id, action, from_status, to_status, operator_name, operator_role, note, attachments, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
    [
      `alarm-log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      input.tenantId,
      input.alarmId,
      input.action,
      input.fromStatus,
      input.toStatus,
      input.operatorName,
      input.operatorRole,
      input.note,
      JSON.stringify(input.attachments),
      createdAt,
    ],
  );
}

async function createNotificationRecordsForAlarm(
  client: PoolClient,
  tenantId: string,
  alarmId: string,
  level: "alarm" | "fault",
  content: string,
  createdAt: string,
) {
  const templates = await client.query(
    "SELECT * FROM notification_templates WHERE tenant_id = $1 AND level = $2 AND enabled = TRUE ORDER BY created_at ASC",
    [tenantId, level],
  );

  for (const template of templates.rows) {
    await client.query(
      `INSERT INTO notification_records (id, tenant_id, alarm_id, template_id, channel, level, target_name, content, status, retry_count, last_error, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        `notify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        tenantId,
        alarmId,
        template.id,
        template.channel,
        level,
        jsonStringArray(template.target_roles).join(" / "),
        template.template_text.replaceAll("{{content}}", content),
        "sent",
        0,
        "",
        createdAt,
        createdAt,
      ],
    );
  }
}

export async function getTenantAlarmCenterData(tenantId: string): Promise<AlarmCenterItem[]> {
  await ensureDatabase();
  const alarms = await allReady<any>(
    "SELECT * FROM tenant_alarms WHERE tenant_id = $1 ORDER BY time DESC, id DESC LIMIT 400",
    [tenantId],
  );

  if (alarms.length === 0) {
    return [];
  }

  const timelines = await allReady<any>(
    "SELECT * FROM alarm_logs WHERE tenant_id = $1 ORDER BY created_at DESC",
    [tenantId],
  );

  return alarms.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    deviceId: row.device_id,
    deviceName: row.device_name,
    location: row.location,
    alarmType: normalizeAlarmTypeText(row.alarm_type),
    time: row.time,
    processStatus: normalizeStatusText(row.process_status),
    workflowStatus: normalizeWorkflowStatus(row.workflow_status),
    falseAlarm: Boolean(row.false_alarm),
    detailNote: row.detail_note,
    attachments: jsonStringArray(row.attachments),
    assignedUserName: row.assigned_user_name,
    lastOperatorName: row.last_operator_name,
    acknowledgedAt: row.acknowledged_at ?? undefined,
    processingAt: row.processing_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    closedAt: row.closed_at ?? undefined,
    closedReason: row.closed_reason,
    timeline: timelines.filter((item) => item.alarm_id === row.id).map(mapAlarmTimeline),
  }));
}

export async function updateTenantAlarmWorkflow(
  tenantId: string,
  input: {
    alarmId: string;
    nextStatus: AlarmWorkflowStatus;
    falseAlarm?: boolean;
    note?: string;
    attachments?: string[];
    assignedUserName?: string;
    operatorName: string;
    operatorRole: string;
  },
) {
  await ensureDatabase();
  const now = formatLocalTimestamp();

  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const alarm = await client.query("SELECT * FROM tenant_alarms WHERE tenant_id = $1 AND id = $2 LIMIT 1", [
        tenantId,
        input.alarmId,
      ]);

      if (alarm.rowCount === 0) {
        throw new Error("ALARM_NOT_FOUND");
      }

      const current = alarm.rows[0];
      const previousStatus = normalizeWorkflowStatus(current.workflow_status ?? current.process_status);
      const nextProcessStatus =
        input.nextStatus === "处理中"
          ? "处理中"
          : input.nextStatus === "已完成" || input.nextStatus === "已关闭"
            ? "已处理"
            : "未处理";

      await client.query(
        `UPDATE tenant_alarms
         SET workflow_status = $1,
             process_status = $2,
             false_alarm = $3,
             detail_note = $4,
             attachments = $5::jsonb,
             assigned_user_name = $6,
             last_operator_name = $7,
             acknowledged_at = CASE WHEN $1 = '已确认' AND acknowledged_at IS NULL THEN $8 ELSE acknowledged_at END,
             processing_at = CASE WHEN $1 = '处理中' AND processing_at IS NULL THEN $8 ELSE processing_at END,
             completed_at = CASE WHEN $1 = '已完成' AND completed_at IS NULL THEN $8 ELSE completed_at END,
             closed_at = CASE WHEN $1 = '已关闭' AND closed_at IS NULL THEN $8 ELSE closed_at END,
             closed_reason = $9
         WHERE tenant_id = $10 AND id = $11`,
        [
          input.nextStatus,
          nextProcessStatus,
          Boolean(input.falseAlarm),
          input.note ?? current.detail_note ?? "",
          JSON.stringify(input.attachments ?? jsonStringArray(current.attachments)),
          input.assignedUserName ?? current.assigned_user_name ?? "",
          input.operatorName,
          now,
          input.falseAlarm ? "误报关闭" : current.closed_reason ?? "",
          tenantId,
          input.alarmId,
        ],
      );

      await insertAlarmTimeline(client, {
        tenantId,
        alarmId: input.alarmId,
        action: input.falseAlarm ? "标记误报" : "状态流转",
        fromStatus: previousStatus,
        toStatus: input.nextStatus,
        operatorName: input.operatorName,
        operatorRole: input.operatorRole,
        note: input.note ?? "",
        attachments: input.attachments ?? [],
        createdAt: now,
      });

      const mappedStatus = await syncDeviceRuntimeFromAlarms(client, tenantId, current.device_id, now, null);

      await insertAuditLog(client, {
        tenantId,
        actorScope: "tenant",
        actorName: input.operatorName,
        actorRole: input.operatorRole,
        action: "alarm.workflow.update",
        targetType: "alarm",
        targetId: input.alarmId,
        result: "success",
        detail: `${previousStatus} -> ${input.nextStatus}${input.falseAlarm ? "，标记误报" : ""}`,
        createdAt: now,
      });

      await insertDutyLog(client, {
        tenantId,
        logType: "alarm_action",
        content: `报警 ${current.device_name} 状态由 ${previousStatus} 更新为 ${input.nextStatus}`,
        operatorName: input.operatorName,
        createdAt: now,
      });

      await client.query("COMMIT");

      publishTenantEvent(tenantId, {
        type: "alarm_updated",
        tenantId,
        deviceId: current.device_id,
        eventType: "alarm_workflow_updated",
        eventCode: input.nextStatus,
        reportedAt: now,
        occurredAt: now,
      });

      return { deviceStatus: mappedStatus.deviceStatusText };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

export async function getTenantNotificationCenterData(tenantId: string) {
  await ensureDatabase();
  const [templates, records] = await Promise.all([
    allReady<any>("SELECT * FROM notification_templates WHERE tenant_id = $1 ORDER BY updated_at DESC", [tenantId]),
    allReady<any>("SELECT * FROM notification_records WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 300", [tenantId]),
  ]);

  return {
    templates: templates.map(mapNotificationTemplate),
    records: records.map(mapNotificationRecord),
  };
}

export async function retryNotificationRecord(tenantId: string, recordId: string) {
  await ensureDatabase();
  const now = formatLocalTimestamp();
  await queryReady(
    `UPDATE notification_records
     SET status = 'sent',
         retry_count = retry_count + 1,
         last_error = '',
         updated_at = $1
     WHERE tenant_id = $2 AND id = $3`,
    [now, tenantId, recordId],
  );
}

export async function getTenantAuditLogs(tenantId: string) {
  await ensureDatabase();
  const rows = await allReady<any>(
    "SELECT * FROM audit_logs WHERE tenant_id = $1 OR tenant_id IS NULL ORDER BY created_at DESC LIMIT 500",
    [tenantId],
  );
  return rows.map(mapAuditLog);
}

export async function createAuditLog(input: Omit<AuditLogRecord, "id" | "createdAt"> & { createdAt?: string }) {
  await ensureDatabase();
  await withClient(async (client) => insertAuditLog(client, input));
}

export async function createDutyLogEntry(input: Omit<DutyLogRecord, "id" | "createdAt"> & { createdAt?: string }) {
  await ensureDatabase();
  await withClient(async (client) => insertDutyLog(client, input));
}

export async function getTenantSystemHealth(tenantId: string): Promise<SystemHealthPayload> {
  await ensureDatabase();
  const now = new Date();
  const [devices, events, audits] = await Promise.all([
    allReady<any>("SELECT * FROM tenant_devices WHERE tenant_id = $1", [tenantId]),
    allReady<any>("SELECT * FROM raw_device_events WHERE tenant_id = $1 ORDER BY reported_at DESC LIMIT 20", [tenantId]),
    allReady<any>("SELECT * FROM audit_logs WHERE tenant_id = $1 AND result = 'error' ORDER BY created_at DESC LIMIT 20", [tenantId]),
  ]);

  const totalDevices = devices.length || 1;
  const onlineDevices = devices.filter((row) => normalizeStatusText(row.status) !== "离线").length;
  const onlineRate = (onlineDevices / totalDevices) * 100;

  const latestAlarmEvent = events.find((row) => String(row.event_type) === "alarm") ?? events[0];
  const latestEventDate = latestAlarmEvent ? parseDbDate(latestAlarmEvent.reported_at) : null;
  const delaySeconds = latestEventDate ? Math.max(0, Math.round((now.getTime() - latestEventDate.getTime()) / 1000)) : 0;

  const metrics: SystemHealthMetric[] = [
    {
      code: "realtime_link",
      name: "实时连接状态",
      value: delaySeconds <= 10 ? 1 : delaySeconds <= 30 ? 0.5 : 0,
      displayValue: delaySeconds <= 10 ? "稳定" : delaySeconds <= 30 ? "波动" : "异常",
      unit: "",
      level: delaySeconds <= 10 ? "normal" : delaySeconds <= 30 ? "warning" : "critical",
      detail: "按最近事件到达延迟估算实时链路状态。",
    },
    {
      code: "alarm_delay",
      name: "最近报警延迟",
      value: delaySeconds,
      displayValue: String(delaySeconds),
      unit: "秒",
      level: delaySeconds <= 5 ? "normal" : delaySeconds <= 15 ? "warning" : "critical",
      detail: "按最近原始事件时间与当前系统时间计算。",
    },
    {
      code: "device_online_rate",
      name: "设备在线率",
      value: Number(onlineRate.toFixed(1)),
      displayValue: onlineRate.toFixed(1),
      unit: "%",
      level: onlineRate >= 95 ? "normal" : onlineRate >= 85 ? "warning" : "critical",
      detail: "按企业当前非离线设备占比计算。",
    },
    {
      code: "error_log_count",
      name: "错误日志数量",
      value: audits.length,
      displayValue: String(audits.length),
      unit: "条",
      level: audits.length === 0 ? "normal" : audits.length <= 5 ? "warning" : "critical",
      detail: "统计最近错误审计日志数量。",
    },
    {
      code: "api_response_time",
      name: "接口响应时间",
      value: 0,
      displayValue: "前端测量",
      unit: "ms",
      level: "normal",
      detail: "由前端页面请求时测量，不使用静态库值。",
    },
  ];

  return {
    generatedAt: formatLocalTimestamp(),
    metrics,
    recentErrors: audits.map(mapAuditLog),
    latestEvents: events.map((row) => ({
      id: row.id,
      deviceId: row.device_id,
      eventType: row.event_type,
      eventCode: row.event_code,
      reportedAt: row.reported_at,
    })),
  };
}

function resolveCurrentDutySchedule(schedules: DutyScheduleRecord[]) {
  const now = new Date();
  const currentDate = formatLocalDate(now);
  const minutes = now.getHours() * 60 + now.getMinutes();

  for (const schedule of schedules) {
    if (schedule.dutyDate !== currentDate) {
      continue;
    }
    const [startHour, startMinute] = schedule.shiftStartTime.split(":").map(Number);
    const [endHour, endMinute] = schedule.shiftEndTime.split(":").map(Number);
    const start = (startHour || 0) * 60 + (startMinute || 0);
    const end = (endHour || 0) * 60 + (endMinute || 0);
    const inRange = end > start ? minutes >= start && minutes < end : minutes >= start || minutes < end;
    if (inRange) {
      return schedule;
    }
  }

  return schedules.find((item) => item.dutyDate === currentDate);
}

export async function getDutyCenterData(tenantId: string): Promise<DutyCenterPayload> {
  await ensureDatabase();
  const [shiftRows, scheduleRows, logRows, openAlarmRow] = await Promise.all([
    allReady<any>("SELECT * FROM duty_shifts WHERE tenant_id = $1 ORDER BY start_time ASC", [tenantId]),
    allReady<any>("SELECT * FROM duty_schedules WHERE tenant_id = $1 ORDER BY duty_date DESC, shift_id ASC LIMIT 30", [tenantId]),
    allReady<any>("SELECT * FROM duty_logs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 200", [tenantId]),
    getReady<any>(
      "SELECT COUNT(*)::int AS count FROM tenant_alarms WHERE tenant_id = $1 AND process_status <> '已处理'",
      [tenantId],
    ),
  ]);

  const shifts = shiftRows.map(mapDutyShift);
  const schedules = scheduleRows.map((row) => mapDutySchedule(row, shifts));
  return {
    generatedAt: formatLocalTimestamp(),
    shifts,
    schedules,
    currentSchedule: resolveCurrentDutySchedule(schedules),
    openAlarmCount: Number(openAlarmRow?.count ?? 0),
    dutyLogs: logRows.map(mapDutyLog),
  };
}

export async function createDutySchedule(
  tenantId: string,
  input: {
    dutyDate: string;
    shiftId: string;
    assigneeName: string;
    assigneePhone: string;
    assignedBy: string;
  },
) {
  await ensureDatabase();
  const id = createId("duty-schedule");
  const createdAt = formatLocalTimestamp();

  await withClient(async (client) => {
    await client.query(
      `INSERT INTO duty_schedules (id, tenant_id, duty_date, shift_id, assignee_name, assignee_phone, assigned_by, status, started_at, ended_at, handover_note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'scheduled',NULL,NULL,'')`,
      [id, tenantId, input.dutyDate, input.shiftId, input.assigneeName, input.assigneePhone, input.assignedBy],
    );

    await insertDutyLog(client, {
      tenantId,
      scheduleId: id,
      logType: "shift_action",
      content: `新增值班排班：${input.dutyDate} / ${input.assigneeName}`,
      operatorName: input.assignedBy,
      createdAt,
    });

    await insertAuditLog(client, {
      tenantId,
      actorScope: "tenant",
      actorName: input.assignedBy,
      actorRole: "tenant_dispatcher",
      action: "duty.schedule.create",
      targetType: "duty_schedule",
      targetId: id,
      result: "success",
      detail: `${input.dutyDate} / ${input.shiftId} / ${input.assigneeName}`,
      createdAt,
    });
  });
}

export async function handoverDutySchedule(
  tenantId: string,
  input: {
    scheduleId: string;
    nextScheduleId?: string;
    note: string;
    operatorName: string;
  },
) {
  await ensureDatabase();
  const createdAt = formatLocalTimestamp();

  await withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const openAlarmRow = await client.query(
        "SELECT COUNT(*)::int AS count FROM tenant_alarms WHERE tenant_id = $1 AND process_status <> '已处理'",
        [tenantId],
      );
      const openAlarmCount = Number(openAlarmRow.rows[0]?.count ?? 0);

      if (openAlarmCount > 0 && !input.note.trim()) {
        throw new Error("HANDOVER_NOTE_REQUIRED");
      }

      await client.query(
        `UPDATE duty_schedules
         SET status = 'handover', ended_at = $1, handover_note = $2
         WHERE tenant_id = $3 AND id = $4`,
        [createdAt, input.note, tenantId, input.scheduleId],
      );

      if (input.nextScheduleId) {
        await client.query(
          `UPDATE duty_schedules
           SET status = 'active', started_at = COALESCE(started_at, $1)
           WHERE tenant_id = $2 AND id = $3`,
          [createdAt, tenantId, input.nextScheduleId],
        );
      }

      await insertDutyLog(client, {
        tenantId,
        scheduleId: input.scheduleId,
        logType: "handover",
        content: `完成交接班，遗留未闭环报警 ${openAlarmCount} 条。${input.note ? `备注：${input.note}` : ""}`,
        operatorName: input.operatorName,
        createdAt,
      });

      await insertAuditLog(client, {
        tenantId,
        actorScope: "tenant",
        actorName: input.operatorName,
        actorRole: "tenant_duty_operator",
        action: "duty.handover",
        targetType: "duty_schedule",
        targetId: input.scheduleId,
        result: "success",
        detail: `未闭环报警 ${openAlarmCount} 条`,
        createdAt,
      });

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

export async function getInspectionCenterData(tenantId: string): Promise<InspectionCenterPayload> {
  await ensureDatabase();
  const [tasks, records, issues, maintenanceRecords] = await Promise.all([
    allReady<any>("SELECT * FROM inspection_tasks WHERE tenant_id = $1 ORDER BY due_date DESC, created_at DESC LIMIT 200", [tenantId]),
    allReady<any>("SELECT * FROM inspection_records WHERE tenant_id = $1 ORDER BY inspected_at DESC LIMIT 300", [tenantId]),
    allReady<any>("SELECT * FROM issues WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 200", [tenantId]),
    allReady<any>("SELECT * FROM maintenance_records WHERE tenant_id = $1 ORDER BY next_due_date ASC LIMIT 200", [tenantId]),
  ]);

  return {
    generatedAt: formatLocalTimestamp(),
    tasks: tasks.map(mapInspectionTask),
    records: records.map(mapInspectionRecord),
    issues: issues.map(mapIssue),
    maintenanceRecords: maintenanceRecords.map(mapMaintenanceRecord),
  };
}

export async function createInspectionTask(
  tenantId: string,
  input: {
    title: string;
    planType: "daily" | "weekly";
    targetType: "device" | "area";
    targetId: string;
    targetName: string;
    dueDate: string;
    assignedTo: string;
    note: string;
    operatorName: string;
  },
) {
  await ensureDatabase();
  const taskId = createId("inspection-task");
  const createdAt = formatLocalTimestamp();

  await withClient(async (client) => {
    await client.query(
      `INSERT INTO inspection_tasks (id, tenant_id, title, plan_type, target_type, target_id, target_name, due_date, assigned_to, status, note, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11)`,
      [
        taskId,
        tenantId,
        input.title,
        input.planType,
        input.targetType,
        input.targetId,
        input.targetName,
        input.dueDate,
        input.assignedTo,
        input.note,
        createdAt,
      ],
    );

    await insertAuditLog(client, {
      tenantId,
      actorScope: "tenant",
      actorName: input.operatorName,
      actorRole: "tenant_inspection_manager",
      action: "inspection.task.create",
      targetType: "inspection_task",
      targetId: taskId,
      result: "success",
      detail: `${input.title} / ${input.targetName}`,
      createdAt,
    });
  });
}

export async function submitInspectionRecord(
  tenantId: string,
  input: {
    taskId: string;
    result: "completed" | "abnormal";
    note: string;
    inspectedBy: string;
  },
) {
  await ensureDatabase();
  const createdAt = formatLocalTimestamp();
  const recordId = createId("inspection-record");

  await withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const taskRow = await client.query("SELECT * FROM inspection_tasks WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, input.taskId]);
      if (taskRow.rowCount === 0) {
        throw new Error("INSPECTION_TASK_NOT_FOUND");
      }

      const task = taskRow.rows[0];
      await client.query(
        `INSERT INTO inspection_records (id, tenant_id, task_id, result, note, inspected_by, inspected_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [recordId, tenantId, input.taskId, input.result, input.note, input.inspectedBy, createdAt],
      );

      await client.query("UPDATE inspection_tasks SET status = $1 WHERE tenant_id = $2 AND id = $3", [
        input.result === "abnormal" ? "abnormal" : "completed",
        tenantId,
        input.taskId,
      ]);

      if (input.result === "abnormal") {
        const issueId = createId("issue");
        await client.query(
          `INSERT INTO issues (id, tenant_id, source_type, source_id, title, level, status, note, rectification_deadline, rectified_at, reviewed_at, created_at)
           VALUES ($1,$2,'inspection',$3,$4,'medium','未整改',$5,$6,NULL,NULL,$7)`,
          [issueId, tenantId, input.taskId, `${task.title} 发现异常`, input.note, formatLocalDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)), createdAt],
        );
      }

      await insertAuditLog(client, {
        tenantId,
        actorScope: "tenant",
        actorName: input.inspectedBy,
        actorRole: "tenant_inspector",
        action: "inspection.record.submit",
        targetType: "inspection_task",
        targetId: input.taskId,
        result: "success",
        detail: `result=${input.result}`,
        createdAt,
      });

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

export async function updateIssueStatus(
  tenantId: string,
  input: {
    issueId: string;
    status: "未整改" | "整改中" | "已整改" | "已复查";
    note: string;
    operatorName: string;
  },
) {
  await ensureDatabase();
  const createdAt = formatLocalTimestamp();

  await withClient(async (client) => {
    await client.query(
      `UPDATE issues
       SET status = $1,
           note = $2,
           rectified_at = CASE WHEN $1 = '已整改' THEN COALESCE(rectified_at, $3) ELSE rectified_at END,
           reviewed_at = CASE WHEN $1 = '已复查' THEN COALESCE(reviewed_at, $3) ELSE reviewed_at END
       WHERE tenant_id = $4 AND id = $5`,
      [input.status, input.note, createdAt, tenantId, input.issueId],
    );

    await insertAuditLog(client, {
      tenantId,
      actorScope: "tenant",
      actorName: input.operatorName,
      actorRole: "tenant_issue_manager",
      action: "issue.status.update",
      targetType: "issue",
      targetId: input.issueId,
      result: "success",
      detail: input.status,
      createdAt,
    });
  });
}

export async function getAdminState() {
  return {
    tenants: (await allReady<any>("SELECT * FROM tenants ORDER BY created_at ASC")).map(mapTenant),
    plans: (await allReady<any>("SELECT * FROM plans ORDER BY name ASC")).map(mapPlan),
    subscriptions: (await allReady<any>("SELECT * FROM subscriptions ORDER BY start_date DESC")).map(mapSubscription),
    platformUsers: (await allReady<any>("SELECT * FROM platform_users ORDER BY username ASC")).map(mapPlatformUser),
    tenantUsers: (await allReady<any>("SELECT * FROM tenant_users ORDER BY tenant_id ASC, username ASC")).map(mapTenantUser),
    tenantDevices: (await allReady<any>("SELECT * FROM tenant_devices ORDER BY tenant_id ASC, name ASC")).map(mapTenantDevice),
    tenantAlarms: (await allReady<any>("SELECT * FROM tenant_alarms ORDER BY time DESC")).map(mapAlarm),
    notificationSettings: (await allReady<any>("SELECT * FROM notification_settings ORDER BY tenant_id ASC")).map(
      mapNotification,
    ),
    quotaUsage: (await allReady<any>("SELECT * FROM quota_usage ORDER BY tenant_id ASC")).map(mapQuota),
  };
}

export async function replaceAdminState(input: any) {
  await ensureDatabase();

  await withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query(`
        DELETE FROM subscriptions;
        DELETE FROM platform_users;
        DELETE FROM tenant_users;
        DELETE FROM tenant_alarms;
        DELETE FROM tenant_devices;
        DELETE FROM notification_settings;
        DELETE FROM quota_usage;
        DELETE FROM plans;
        DELETE FROM tenants;
      `);

      for (const item of input.tenants ?? []) {
        await client.query(
          "INSERT INTO tenants (id, name, code, industry, contact_name, contact_phone, status, created_at, note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          [item.id, item.name, item.code, item.industry, item.contactName, item.contactPhone, item.status, item.createdAt, item.note],
        );
      }

      for (const item of input.plans ?? []) {
        await client.query(
          "INSERT INTO plans (id, name, code, status, price_monthly, max_devices, max_users, sms_quota, feature_keys, description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)",
          [
            item.id,
            item.name,
            item.code,
            item.status,
            item.priceMonthly,
            item.maxDevices,
            item.maxUsers,
            item.smsQuota,
            JSON.stringify(item.featureKeys ?? []),
            item.description,
          ],
        );
      }

      for (const item of input.subscriptions ?? []) {
        await client.query(
          "INSERT INTO subscriptions (id, tenant_id, plan_id, status, start_date, end_date, trial, auto_renew) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
          [item.id, item.tenantId, item.planId, item.status, item.startDate, item.endDate, !!item.trial, !!item.autoRenew],
        );
      }

      for (const item of input.platformUsers ?? []) {
        await client.query(
          "INSERT INTO platform_users (id, username, phone, role_key, status, note) VALUES ($1,$2,$3,$4,$5,$6)",
          [item.id, item.username, item.phone, item.roleKey, item.status, item.note],
        );
      }

      for (const item of input.tenantUsers ?? []) {
        await client.query(
          "INSERT INTO tenant_users (id, tenant_id, username, phone, role_key, status, sms_enabled, message_types, note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)",
          [
            item.id,
            item.tenantId,
            item.username,
            item.phone,
            item.roleKey,
            item.status,
            !!item.smsEnabled,
            JSON.stringify(item.messageTypes ?? []),
            item.note,
          ],
        );
      }

      for (const item of input.tenantDevices ?? []) {
        await client.query(
          "INSERT INTO tenant_devices (id, tenant_id, name, type, area, installation_location, status, last_report_at, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          [
            item.id,
            item.tenantId,
            item.name,
            item.type,
            item.area,
            item.installationLocation,
            item.status,
            item.lastReportAt,
            item.notes,
          ],
        );
      }

      for (const item of input.tenantAlarms ?? []) {
        await client.query(
          "INSERT INTO tenant_alarms (id, tenant_id, device_id, device_name, location, alarm_type, time, process_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
          [item.id, item.tenantId, item.deviceId, item.deviceName, item.location, item.alarmType, item.time, item.processStatus],
        );
      }

      for (const item of input.notificationSettings ?? []) {
        await client.query(
          "INSERT INTO notification_settings (id, tenant_id, alarm_threshold, notification_enabled, map_placeholder, remark) VALUES ($1,$2,$3,$4,$5,$6)",
          [item.id, item.tenantId, item.alarmThreshold, !!item.notificationEnabled, item.mapPlaceholder, item.remark],
        );
      }

      for (const item of input.quotaUsage ?? []) {
        await client.query(
          "INSERT INTO quota_usage (id, tenant_id, device_count, user_count, sms_used) VALUES ($1,$2,$3,$4,$5)",
          [item.id, item.tenantId, item.deviceCount, item.userCount, item.smsUsed],
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

export async function createTenantWithAdmin(input: CreateTenantWithAdminInput) {
  await ensureDatabase();

  const tenantId = `tenant-${Date.now()}`;
  const tenantUserId = `tenant-user-${Date.now()}`;
  const loginAccountId = `login-account-${Date.now()}`;
  const createdAt = formatLocalDate();
  const displayName = input.admin.displayName || `${input.tenant.name}管理员`;
  const passwordHash = hashPassword(input.admin.password);

  await withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query(
        "INSERT INTO tenants (id, name, code, industry, contact_name, contact_phone, status, created_at, note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [
          tenantId,
          input.tenant.name,
          input.tenant.code,
          input.tenant.industry,
          input.tenant.contactName,
          input.tenant.contactPhone,
          input.tenant.status,
          createdAt,
          input.tenant.note,
        ],
      );

      await client.query(
        "INSERT INTO tenant_users (id, tenant_id, username, phone, role_key, status, sms_enabled, message_types, note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)",
        [
          tenantUserId,
          tenantId,
          input.admin.username,
          input.admin.phone,
          input.admin.roleKey,
          "鍚敤",
          true,
          JSON.stringify(["鎶ヨ淇℃伅"]),
          input.admin.note,
        ],
      );

      await client.query(
        "INSERT INTO login_accounts (id, username, password, password_hash, display_name, scope, role_key, tenant_id, must_change_password) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [
          loginAccountId,
          input.admin.username,
          "",
          passwordHash,
          displayName,
          "tenant",
          input.admin.roleKey,
          tenantId,
          true,
        ],
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });

  return {
    tenant: {
      id: tenantId,
      name: input.tenant.name,
      code: input.tenant.code,
      industry: input.tenant.industry,
      contactName: input.tenant.contactName,
      contactPhone: input.tenant.contactPhone,
      status: input.tenant.status,
      createdAt,
      note: input.tenant.note,
    },
    tenantUser: {
      id: tenantUserId,
      tenantId,
      username: input.admin.username,
      phone: input.admin.phone,
      roleKey: input.admin.roleKey,
      status: "鍚敤",
      smsEnabled: true,
      messageTypes: ["鎶ヨ淇℃伅"],
      note: input.admin.note,
    },
  };
}

export async function updateTenant(input: UpdateTenantInput) {
  await queryReady(
    "UPDATE tenants SET name = $1, code = $2, industry = $3, contact_name = $4, contact_phone = $5, status = $6, note = $7 WHERE id = $8",
    [input.name, input.code, input.industry, input.contactName, input.contactPhone, input.status, input.note, input.id],
  );

  const row = await getReady<any>("SELECT * FROM tenants WHERE id = $1", [input.id]);
  return row ? mapTenant(row) : null;
}

export async function deleteTenantCascade(tenantId: string) {
  await ensureDatabase();

  await withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query("DELETE FROM login_accounts WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM subscriptions WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM tenant_users WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM tenant_alarms WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM tenant_devices WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM notification_settings WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM quota_usage WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM tenants WHERE id = $1", [tenantId]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

export async function listTenantUsers(tenantId: string) {
  return (await allReady<any>("SELECT * FROM tenant_users WHERE tenant_id = $1 ORDER BY username ASC", [tenantId])).map(
    mapTenantUser,
  );
}

export async function upsertTenantUser(tenantId: string, input: any) {
  await ensureDatabase();
  const id = input.id ? String(input.id) : `tenant-user-${Date.now()}`;
  const messageTypes = Array.isArray(input.messageTypes) ? input.messageTypes : [];

  await queryReady(
    `
      INSERT INTO tenant_users (id, tenant_id, username, phone, role_key, status, sms_enabled, message_types, note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
      ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        phone = EXCLUDED.phone,
        role_key = EXCLUDED.role_key,
        status = EXCLUDED.status,
        sms_enabled = EXCLUDED.sms_enabled,
        message_types = EXCLUDED.message_types,
        note = EXCLUDED.note
    `,
    [id, tenantId, input.username, input.phone, input.roleKey, input.status, Boolean(input.smsEnabled), JSON.stringify(messageTypes), input.note ?? ""],
  );

  const row = await getReady<any>("SELECT * FROM tenant_users WHERE id = $1", [id]);
  return mapTenantUser(row);
}

export async function deleteTenantUser(tenantId: string, id: string) {
  await queryReady("DELETE FROM tenant_users WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
}

export async function listTenantDevices(tenantId: string) {
  return (await allReady<any>("SELECT * FROM tenant_devices WHERE tenant_id = $1 ORDER BY name ASC", [tenantId])).map(
    mapTenantDevice,
  );
}

export async function createTenantDrawing(
  tenantId: string,
  input: {
    floorId: string;
    name: string;
    fileUrl: string;
    width: number;
    height: number;
    version: string;
    status?: "draft" | "published" | "archived";
  },
) {
  await ensureDatabase();
  const id = `drawing-${Date.now()}`;
  const updatedAt = formatLocalTimestamp();

  await queryReady(
    `
      INSERT INTO tenant_drawings (id, tenant_id, floor_id, name, file_url, width, height, version, status, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    `,
    [
      id,
      tenantId,
      input.floorId,
      input.name,
      input.fileUrl,
      input.width,
      input.height,
      input.version,
      input.status ?? "published",
      updatedAt,
    ],
  );

  return mapDrawing(await getReady<any>("SELECT * FROM tenant_drawings WHERE id = $1", [id]));
}

export async function deleteTenantDrawing(tenantId: string, drawingId: string) {
  await ensureDatabase();
  await withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query("DELETE FROM tenant_device_points WHERE tenant_id = $1 AND drawing_id = $2", [tenantId, drawingId]);
      await client.query("DELETE FROM tenant_drawings WHERE tenant_id = $1 AND id = $2", [tenantId, drawingId]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

export async function upsertTenantDevicePoint(
  tenantId: string,
  input: {
    id?: string;
    deviceId: string;
    floorId: string;
    drawingId: string;
    x: number;
    y: number;
    rotation?: number;
    icon?: string;
    statusStyle?: "normal" | "alarm" | "fault" | "offline";
  },
) {
  await ensureDatabase();
  const existing = input.id
    ? await getReady<any>("SELECT * FROM tenant_device_points WHERE id = $1 AND tenant_id = $2", [input.id, tenantId])
    : await getReady<any>("SELECT * FROM tenant_device_points WHERE device_id = $1 AND tenant_id = $2", [input.deviceId, tenantId]);
  const id = existing?.id ?? `point-${Date.now()}`;
  const updatedAt = formatLocalTimestamp();

  await queryReady(
    `
      INSERT INTO tenant_device_points (id, tenant_id, device_id, floor_id, drawing_id, x, y, rotation, icon, status_style, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (id) DO UPDATE SET
        device_id = EXCLUDED.device_id,
        floor_id = EXCLUDED.floor_id,
        drawing_id = EXCLUDED.drawing_id,
        x = EXCLUDED.x,
        y = EXCLUDED.y,
        rotation = EXCLUDED.rotation,
        icon = EXCLUDED.icon,
        status_style = EXCLUDED.status_style,
        updated_at = EXCLUDED.updated_at
    `,
    [
      id,
      tenantId,
      input.deviceId,
      input.floorId,
      input.drawingId,
      input.x,
      input.y,
      input.rotation ?? 0,
      input.icon ?? "sensor",
      input.statusStyle ?? "normal",
      updatedAt,
    ],
  );

  await queryReady("UPDATE tenant_devices SET floor_id = $1 WHERE tenant_id = $2 AND id = $3", [
    input.floorId,
    tenantId,
    input.deviceId,
  ]);

  return mapDevicePoint(await getReady<any>("SELECT * FROM tenant_device_points WHERE id = $1", [id]));
}

export async function deleteTenantDevicePoint(tenantId: string, pointId: string) {
  await queryReady("DELETE FROM tenant_device_points WHERE tenant_id = $1 AND id = $2", [tenantId, pointId]);
}

export async function upsertTenantDevice(tenantId: string, input: any) {
  await ensureDatabase();
  const id = input.id ?? `device-${Date.now()}`;

  await queryReady(
    `
      INSERT INTO tenant_devices (id, tenant_id, name, type, area, installation_location, status, last_report_at, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        area = EXCLUDED.area,
        installation_location = EXCLUDED.installation_location,
        status = EXCLUDED.status,
        last_report_at = EXCLUDED.last_report_at,
        notes = EXCLUDED.notes
    `,
    [
      id,
      tenantId,
      input.name,
      input.type,
      input.area,
      input.installationLocation,
      input.status,
      input.lastReportAt,
      input.notes ?? "",
    ],
  );

  const row = await getReady<any>("SELECT * FROM tenant_devices WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
  if (!row) {
    throw new Error("设备保存成功后未能读取到最新记录");
  }
  return mapTenantDevice(row);
}

export async function deleteTenantDevice(tenantId: string, id: string) {
  await queryReady("DELETE FROM tenant_devices WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
}

type DeviceRuntimeStatus = "normal" | "alarm" | "fault" | "offline" | "maintenance";
type AlarmProcessStatus = "未处理" | "处理中" | "已处理";

function mapRuntimeStatus(runtimeStatus: DeviceRuntimeStatus) {
  return {
    runtimeStatus,
    deviceStatusText:
      runtimeStatus === "alarm"
        ? "报警"
        : runtimeStatus === "fault"
          ? "故障"
          : runtimeStatus === "offline"
            ? "离线"
            : runtimeStatus === "maintenance"
              ? "维修中"
              : "正常",
    pointStatusStyle:
      runtimeStatus === "alarm"
        ? "alarm"
        : runtimeStatus === "fault"
          ? "fault"
          : runtimeStatus === "offline"
            ? "offline"
            : "normal",
  };
}

function resolveRuntimeStatusFromAlarmType(alarmType: string): DeviceRuntimeStatus {
  if (alarmType.includes("鐏") || alarmType.includes("火警") || alarmType.includes("报警")) {
    return "alarm";
  }
  if (alarmType.includes("鏁呴殰") || alarmType.includes("故障")) {
    return "fault";
  }
  if (alarmType.includes("绂荤嚎") || alarmType.includes("离线")) {
    return "offline";
  }
  return "normal";
}

async function syncDeviceRuntimeFromAlarms(
  client: PoolClient,
  tenantId: string,
  deviceId: string,
  reportedAt: string,
  gatewayId?: string | null,
) {
  const unresolved = await client.query(
    `
      SELECT alarm_type
      FROM tenant_alarms
      WHERE tenant_id = $1 AND device_id = $2 AND process_status <> $3
      ORDER BY time DESC
      LIMIT 1
    `,
    [tenantId, deviceId, "已处理"],
  );

  const nextRuntimeStatus =
    unresolved.rowCount && unresolved.rows[0]?.alarm_type
      ? resolveRuntimeStatusFromAlarmType(String(unresolved.rows[0].alarm_type))
      : "normal";

  const mapped = mapRuntimeStatus(nextRuntimeStatus);

  await client.query(
    `
      INSERT INTO device_status_snapshots (device_id, tenant_id, gateway_id, status, last_event_type, last_event_code, last_reported_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (device_id) DO UPDATE SET
        gateway_id = COALESCE(EXCLUDED.gateway_id, device_status_snapshots.gateway_id),
        status = EXCLUDED.status,
        last_event_type = EXCLUDED.last_event_type,
        last_event_code = EXCLUDED.last_event_code,
        last_reported_at = EXCLUDED.last_reported_at,
        updated_at = EXCLUDED.updated_at
    `,
    [
      deviceId,
      tenantId,
      gatewayId ?? null,
      mapped.runtimeStatus,
      "status_change",
      "ALARM_STATUS_SYNC",
      reportedAt,
      reportedAt,
    ],
  );

  await client.query("UPDATE tenant_devices SET status = $1, last_report_at = $2 WHERE tenant_id = $3 AND id = $4", [
    mapped.deviceStatusText,
    reportedAt,
    tenantId,
    deviceId,
  ]);

  await client.query(
    "UPDATE tenant_device_points SET status_style = $1, updated_at = $2 WHERE tenant_id = $3 AND device_id = $4",
    [mapped.pointStatusStyle, reportedAt, tenantId, deviceId],
  );

  return mapped;
}

export function getDatabasePath() {
  return getDatabaseUrl() ?? "";
}

export async function updateTenantAlarmProcessStatus(
  tenantId: string,
  alarmId: string,
  processStatus: AlarmProcessStatus,
) {
  await ensureDatabase();

  const updatedAt = formatLocalTimestamp();
  let alarmRow: any;
  let mappedStatus = mapRuntimeStatus("normal");

  await withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const alarm = await client.query(
        "SELECT * FROM tenant_alarms WHERE tenant_id = $1 AND id = $2 LIMIT 1",
        [tenantId, alarmId],
      );

      if (alarm.rowCount === 0) {
        throw new Error("ALARM_NOT_FOUND");
      }

      alarmRow = alarm.rows[0];

      await client.query("UPDATE tenant_alarms SET process_status = $1 WHERE tenant_id = $2 AND id = $3", [
        processStatus,
        tenantId,
        alarmId,
      ]);
      await client.query(
        "UPDATE tenant_alarms SET workflow_status = $1, last_operator_name = $2, completed_at = CASE WHEN $1 = '已完成' THEN $3 ELSE completed_at END WHERE tenant_id = $4 AND id = $5",
        [processStatus === "已处理" ? "已完成" : processStatus, "企业控制台", updatedAt, tenantId, alarmId],
      );

      await insertAlarmTimeline(client, {
        tenantId,
        alarmId,
        action: "快捷处理",
        fromStatus: normalizeWorkflowStatus(alarmRow.workflow_status ?? alarmRow.process_status),
        toStatus: processStatus === "已处理" ? "已完成" : (processStatus as AlarmWorkflowStatus),
        operatorName: "企业控制台",
        operatorRole: "tenant_console",
        note: "",
        attachments: [],
        createdAt: updatedAt,
      });

      mappedStatus = await syncDeviceRuntimeFromAlarms(client, tenantId, alarmRow.device_id, updatedAt, null);

      await insertAuditLog(client, {
        tenantId,
        actorScope: "tenant",
        actorName: "tenant_console",
        actorRole: "tenant_console",
        action: "alarm.quick_status.update",
        targetType: "alarm",
        targetId: alarmId,
        result: "success",
        detail: `process_status -> ${processStatus}`,
        createdAt: updatedAt,
      });

      await insertDutyLog(client, {
        tenantId,
        logType: "alarm_action",
        content: `报警 ${alarmRow.device_name} 快捷处理为 ${processStatus}`,
        operatorName: "企业控制台",
        createdAt: updatedAt,
      });

      const refreshed = await client.query(
        "SELECT * FROM tenant_alarms WHERE tenant_id = $1 AND id = $2 LIMIT 1",
        [tenantId, alarmId],
      );
      alarmRow = refreshed.rows[0];

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });

  publishTenantEvent(tenantId, {
    type: "alarm_updated",
    tenantId,
    deviceId: alarmRow.device_id,
    eventType: "alarm_status_changed",
    eventCode: processStatus,
    reportedAt: updatedAt,
    occurredAt: updatedAt,
    source: "tenant_console",
  });

  return {
    alarm: mapAlarm(alarmRow),
    deviceStatus: mappedStatus.deviceStatusText,
  };
}

export async function ingestDeviceEvent(input: {
  tenantId: string;
  deviceId: string;
  gatewayId?: string;
  eventType: "alarm" | "fault" | "recover" | "heartbeat" | "status_change";
  eventCode: string;
  eventLevel: "info" | "warning" | "critical";
  payload?: Record<string, unknown>;
  source?: string;
  reportedAt?: string;
}) {
  await ensureDatabase();

  const device = await getReady<any>("SELECT * FROM tenant_devices WHERE tenant_id = $1 AND id = $2 LIMIT 1", [
    input.tenantId,
    input.deviceId,
  ]);

  if (!device) {
    throw new Error("DEVICE_NOT_FOUND");
  }

  const reportedAt = input.reportedAt ?? formatLocalTimestamp();
  const eventId = `event-${Date.now()}`;
  const alarmId = `alarm-${Date.now()}`;

  let nextStatus: "normal" | "alarm" | "fault" | "offline" | "maintenance" = "normal";
  let alarmTypeLabel = "";
  let shouldCreateAlarm = false;

  if (input.eventType === "alarm") {
    nextStatus = "alarm";
    alarmTypeLabel = "火警报警";
    shouldCreateAlarm = true;
  } else if (input.eventType === "fault") {
    nextStatus = "fault";
    alarmTypeLabel = "设备故障";
    shouldCreateAlarm = true;
  } else if (input.eventType === "status_change" && input.eventCode === "DEVICE_OFFLINE") {
    nextStatus = "offline";
    alarmTypeLabel = "设备离线";
    shouldCreateAlarm = true;
  } else if (input.eventType === "recover" || input.eventType === "heartbeat") {
    nextStatus = "normal";
  } else if (input.eventType === "status_change" && input.eventCode === "DEVICE_ONLINE") {
    nextStatus = "normal";
  }

  const statusTextMap: Record<typeof nextStatus, string> = {
    normal: "姝ｅ父",
    alarm: "鎶ヨ",
    fault: "鏁呴殰",
    offline: "绂荤嚎",
  };
  const statusText = statusTextMap[nextStatus];

  const pointStatusStyle =
    nextStatus === "alarm"
      ? "alarm"
      : nextStatus === "fault"
        ? "fault"
        : nextStatus === "offline"
          ? "offline"
          : "normal";

  await withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query(
        `
          INSERT INTO raw_device_events (id, tenant_id, device_id, gateway_id, event_type, event_code, event_level, payload, reported_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
        `,
        [
          eventId,
          input.tenantId,
          input.deviceId,
          input.gatewayId ?? null,
          input.eventType,
          input.eventCode,
          input.eventLevel,
          JSON.stringify({ ...(input.payload ?? {}), source: input.source ?? "simulator" }),
          reportedAt,
        ],
      );

      await client.query(
        `
          INSERT INTO device_status_snapshots (device_id, tenant_id, gateway_id, status, last_event_type, last_event_code, last_reported_at, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          ON CONFLICT (device_id) DO UPDATE SET
            gateway_id = EXCLUDED.gateway_id,
            status = EXCLUDED.status,
            last_event_type = EXCLUDED.last_event_type,
            last_event_code = EXCLUDED.last_event_code,
            last_reported_at = EXCLUDED.last_reported_at,
            updated_at = EXCLUDED.updated_at
        `,
        [
          input.deviceId,
          input.tenantId,
          input.gatewayId ?? device.gateway_id ?? null,
          nextStatus,
          input.eventType,
          input.eventCode,
          reportedAt,
          reportedAt,
        ],
      );

      await client.query("UPDATE tenant_devices SET status = $1, last_report_at = $2 WHERE tenant_id = $3 AND id = $4", [
        statusText,
        reportedAt,
        input.tenantId,
        input.deviceId,
      ]);

      await client.query(
        "UPDATE tenant_device_points SET status_style = $1, updated_at = $2 WHERE tenant_id = $3 AND device_id = $4",
        [pointStatusStyle, reportedAt, input.tenantId, input.deviceId],
      );

        if (shouldCreateAlarm) {
          await client.query(
            `
            INSERT INTO tenant_alarms (id, tenant_id, device_id, device_name, location, alarm_type, time, process_status, workflow_status, detail_note, attachments, false_alarm, assigned_user_name, last_operator_name, closed_reason)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15)
            `,
            [
              alarmId,
              input.tenantId,
              input.deviceId,
              device.name,
              `${device.area} / ${device.installation_location}`,
              alarmTypeLabel,
              reportedAt,
              "未处理",
              "未处理",
              "",
              JSON.stringify([]),
              false,
              "",
              "系统接入",
              "",
            ],
          );

          await insertAlarmTimeline(client, {
            tenantId: input.tenantId,
            alarmId,
            action: "报警生成",
            fromStatus: "未处理",
            toStatus: "未处理",
            operatorName: "系统接入",
            operatorRole: "device_ingestion",
            note: `${alarmTypeLabel} 已进入闭环流程`,
            attachments: [],
            createdAt: reportedAt,
          });

          await createNotificationRecordsForAlarm(
            client,
            input.tenantId,
            alarmId,
            nextStatus === "fault" ? "fault" : "alarm",
            `${device.name} / ${alarmTypeLabel} / ${reportedAt}`,
            reportedAt,
          );

          await client.query(
            `INSERT INTO system_health_snapshots (id, tenant_id, metric_code, metric_name, metric_value, metric_unit, level, detail, recorded_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [
              `health-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              input.tenantId,
              "alarm_delay",
              "最近报警延迟",
              0,
              "秒",
              "normal",
              `${alarmTypeLabel} 已接入`,
              reportedAt,
            ],
          );
        } else {
          await client.query(
            `
            UPDATE tenant_alarms
            SET process_status = '已处理'
            WHERE tenant_id = $1 AND device_id = $2 AND process_status <> '已处理'
          `,
          [input.tenantId, input.deviceId],
        );
        }

        await insertAuditLog(client, {
          tenantId: input.tenantId,
          actorScope: "platform",
          actorName: input.source ?? "device_ingestion",
          actorRole: "device_ingestion",
          action: "device.event.ingested",
          targetType: "device",
          targetId: input.deviceId,
          result: "success",
          detail: `${input.eventType}/${input.eventCode}`,
          createdAt: reportedAt,
        });

        await client.query("COMMIT");
      } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });

  publishTenantEvent(input.tenantId, {
    type: shouldCreateAlarm ? "alarm_created" : "device_status_changed",
    tenantId: input.tenantId,
    deviceId: input.deviceId,
    eventType: input.eventType,
    eventCode: input.eventCode,
    reportedAt,
    occurredAt: reportedAt,
    source: input.source ?? "simulator",
  });

  return {
    success: true,
    reportedAt,
    status: nextStatus,
  };
}



