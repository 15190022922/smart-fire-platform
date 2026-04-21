/* eslint-disable @typescript-eslint/no-explicit-any */
import { Pool, type PoolClient } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

type QueryResultRow = Record<string, unknown>;

declare global {
  var __smartFirePgPool: Pool | undefined;
  var __smartFirePgInitPromise: Promise<void> | undefined;
}

function getPool() {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!globalThis.__smartFirePgPool) {
    globalThis.__smartFirePgPool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
      max: 10,
    });
  }

  return globalThis.__smartFirePgPool;
}

async function withClient<T>(runner: (client: PoolClient) => Promise<T>) {
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

async function createSchema(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS login_accounts (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      display_name TEXT NOT NULL,
      scope TEXT NOT NULL,
      role_key TEXT NOT NULL,
      tenant_id TEXT
    );

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
  `);
}

async function seedIfEmpty(client: PoolClient) {
  const existing = await client.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM tenants");
  if (Number(existing.rows[0]?.count ?? 0) > 0) {
    return;
  }

  await client.query(`
    INSERT INTO tenants (id, name, code, industry, contact_name, contact_phone, status, created_at, note) VALUES
    ('tenant-huaxing', '华星制造', 'HX-001', '制造业', '陈志远', '13800110001', '启用', '2026-01-08', '已接入 2 个厂区，后续计划接入维保模块。'),
    ('tenant-anhe', '安和商业中心', 'AH-002', '商业综合体', '刘晓敏', '13800110002', '启用', '2026-02-15', '关注报警中心与大屏态势。')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO plans (id, name, code, status, price_monthly, max_devices, max_users, sms_quota, feature_keys, description) VALUES
    ('plan-basic', '基础版', 'basic', '启用', 1999, 100, 20, 500, '["dashboard","alarm_center","device_management","user_management","settings"]'::jsonb, '适合中小型企业，覆盖基础监控、报警与设备管理能力。'),
    ('plan-pro', '专业版', 'pro', '启用', 4999, 500, 80, 3000, '["dashboard","alarm_center","device_management","user_management","settings","advanced_reports","maintenance"]'::jsonb, '提供高级报表与巡检维保，适合多园区、多班组企业。'),
    ('plan-enterprise', '企业版', 'enterprise', '启用', 9999, 2000, 300, 12000, '["dashboard","alarm_center","device_management","user_management","settings","advanced_reports","maintenance","api_access"]'::jsonb, '面向集团客户，提供 API 对接与高配额能力。')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO subscriptions (id, tenant_id, plan_id, status, start_date, end_date, trial, auto_renew) VALUES
    ('sub-1', 'tenant-huaxing', 'plan-enterprise', '已生效', '2026-01-10', '2027-01-09', false, true),
    ('sub-2', 'tenant-anhe', 'plan-pro', '试用中', '2026-04-01', '2026-05-01', true, false)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO platform_users (id, username, phone, role_key, status, note) VALUES
    ('platform-user-1', 'super.admin', '13900110001', 'platform_super_admin', '启用', '平台唯一超级管理员账号。')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO tenant_users (id, tenant_id, username, phone, role_key, status, sms_enabled, message_types, note) VALUES
    ('tenant-user-1', 'tenant-huaxing', 'hx_admin', '13700000001', 'tenant_level_1', '启用', true, '["报警信息","故障信息"]'::jsonb, '华星制造总值班负责人。'),
    ('tenant-user-2', 'tenant-huaxing', 'hx_duty', '13700000002', 'tenant_level_2', '启用', true, '["报警信息"]'::jsonb, '华星制造中控室值班员。'),
    ('tenant-user-3', 'tenant-anhe', 'ah_admin', '13700000003', 'tenant_level_1', '启用', true, '["报警信息","故障信息"]'::jsonb, '安和商业中心管理员。')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO login_accounts (id, username, password, display_name, scope, role_key, tenant_id) VALUES
    ('account-platform-1', 'platform_admin', 'Admin123456', '平台超级管理员', 'platform', 'platform_super_admin', NULL),
    ('account-tenant-hx-1', 'hx_admin', 'Hx123456', '华星制造管理员', 'tenant', 'tenant_level_1', 'tenant-huaxing'),
    ('account-tenant-ah-1', 'ah_admin', 'Ah123456', '安和商业中心管理员', 'tenant', 'tenant_level_1', 'tenant-anhe')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO tenant_devices (id, tenant_id, name, type, area, installation_location, status, last_report_at, notes) VALUES
    ('device-hx-1', 'tenant-huaxing', '1号厂房烟感 A-101', '烟雾探测器', '1号厂房', '东侧配电区', '报警', '2026-04-20 09:12:45', '今日 09:12 触发烟雾报警，等待现场核查。'),
    ('device-hx-2', 'tenant-huaxing', '喷淋联动模块 A-208', '联动控制模块', '2号厂房', '主走廊', '正常', '2026-04-20 09:03:11', '运行稳定。'),
    ('device-hx-3', 'tenant-huaxing', '消防泵压力监测 A-301', '水压监测器', '泵房', '北侧泵房', '故障', '2026-04-20 08:55:10', '设备自检异常，待维护。'),
    ('device-ah-1', 'tenant-anhe', '中庭烟感 B-101', '烟雾探测器', '商业中庭', '一层中庭', '正常', '2026-04-20 09:05:12', '状态正常。'),
    ('device-ah-2', 'tenant-anhe', '地下车库手报 B-204', '手动报警按钮', '地下车库', 'B2 电梯前室', '离线', '2026-04-20 07:18:20', '网络链路中断。')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO tenant_alarms (id, tenant_id, device_id, device_name, location, alarm_type, time, process_status) VALUES
    ('alarm-hx-1', 'tenant-huaxing', 'device-hx-1', '1号厂房烟感 A-101', '1号厂房 / 东侧配电区', '烟感触发报警', '2026-04-20 09:12:45', '未处理'),
    ('alarm-hx-2', 'tenant-huaxing', 'device-hx-3', '消防泵压力监测 A-301', '泵房 / 北侧泵房', '故障报警', '2026-04-20 08:55:10', '处理中'),
    ('alarm-ah-1', 'tenant-anhe', 'device-ah-2', '地下车库手报 B-204', '地下车库 / B2 电梯前室', '设备离线', '2026-04-20 07:18:20', '未处理')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO notification_settings (id, tenant_id, alarm_threshold, notification_enabled, map_placeholder, remark) VALUES
    ('notify-hx', 'tenant-huaxing', '烟雾浓度 > 75 ppm', true, '华星制造园区总图 V1', '短信通知发送到总值班负责人和巡检主管。'),
    ('notify-ah', 'tenant-anhe', '烟感连续 10 秒触发报警', true, '安和商业中心楼层图 V3', '商业中庭与车库为重点关注区域。')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO quota_usage (id, tenant_id, device_count, user_count, sms_used) VALUES
    ('quota-hx', 'tenant-huaxing', 328, 34, 980),
    ('quota-ah', 'tenant-anhe', 146, 18, 420)
    ON CONFLICT (id) DO NOTHING;
  `);
}

async function ensureDatabase() {
  if (!globalThis.__smartFirePgInitPromise) {
    globalThis.__smartFirePgInitPromise = withClient(async (client) => {
      await client.query("BEGIN");
      try {
        await createSchema(client);
        await seedIfEmpty(client);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    });
  }

  return globalThis.__smartFirePgInitPromise;
}

async function queryReady<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []) {
  await ensureDatabase();
  return query<T>(sql, params);
}

async function getReady<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []) {
  const result = await queryReady<T>(sql, params);
  return result.rows[0];
}

async function allReady<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []) {
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

function mapTenant(row: any) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    industry: row.industry,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    status: row.status,
    createdAt: row.created_at,
    note: row.note,
  };
}

function mapPlan(row: any) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    status: row.status,
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
    status: row.status,
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
    status: row.status,
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
    status: row.status,
    smsEnabled: Boolean(row.sms_enabled),
    messageTypes: fromJsonArray(row.message_types),
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
    status: row.status,
    lastReportAt: row.last_report_at,
    notes: row.notes,
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
    alarmType: row.alarm_type,
    time: row.time,
    processStatus: row.process_status,
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

export async function findLoginAccount(username: string, password: string) {
  const row = await getReady<any>(
    "SELECT * FROM login_accounts WHERE username = $1 AND password = $2 LIMIT 1",
    [username, password],
  );
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    username: row.username,
    password: row.password,
    displayName: row.display_name,
    scope: row.scope,
    roleKey: row.role_key,
    tenantId: row.tenant_id ?? undefined,
  };
}

export async function updateLoginPassword(username: string, nextPassword: string) {
  await queryReady("UPDATE login_accounts SET password = $1 WHERE username = $2", [nextPassword, username]);
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
  const subscriptionRow = await getReady<any>(
    "SELECT * FROM subscriptions WHERE tenant_id = $1 LIMIT 1",
    [tenantId],
  );
  const subscription = subscriptionRow ? mapSubscription(subscriptionRow) : null;
  const planRow =
    subscription ? await getReady<any>("SELECT * FROM plans WHERE id = $1 LIMIT 1", [subscription.planId]) : undefined;
  const settingsRow = await getReady<any>(
    "SELECT * FROM notification_settings WHERE tenant_id = $1 LIMIT 1",
    [tenantId],
  );
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

export async function getAdminState() {
  const notificationSettings = (
    await allReady<any>("SELECT * FROM notification_settings ORDER BY tenant_id ASC")
  ).map(mapNotification);
  const quotaUsage = (await allReady<any>("SELECT * FROM quota_usage ORDER BY tenant_id ASC")).map(mapQuota);

  return {
    tenants: (await allReady<any>("SELECT * FROM tenants ORDER BY created_at ASC")).map(mapTenant),
    plans: (await allReady<any>("SELECT * FROM plans ORDER BY name ASC")).map(mapPlan),
    subscriptions: (await allReady<any>("SELECT * FROM subscriptions ORDER BY start_date DESC")).map(mapSubscription),
    platformUsers: (await allReady<any>("SELECT * FROM platform_users ORDER BY username ASC")).map(mapPlatformUser),
    tenantUsers: (await allReady<any>("SELECT * FROM tenant_users ORDER BY tenant_id ASC, username ASC")).map(mapTenantUser),
    tenantDevices: (await allReady<any>("SELECT * FROM tenant_devices ORDER BY tenant_id ASC, name ASC")).map(mapTenantDevice),
    tenantAlarms: (await allReady<any>("SELECT * FROM tenant_alarms ORDER BY time DESC")).map(mapAlarm),
    notificationSettings,
    quotaUsage,
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
          "INSERT INTO tenants (id,name,code,industry,contact_name,contact_phone,status,created_at,note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          [item.id, item.name, item.code, item.industry, item.contactName, item.contactPhone, item.status, item.createdAt, item.note],
        );
      }

      for (const item of input.plans ?? []) {
        await client.query(
          "INSERT INTO plans (id,name,code,status,price_monthly,max_devices,max_users,sms_quota,feature_keys,description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)",
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
          "INSERT INTO subscriptions (id,tenant_id,plan_id,status,start_date,end_date,trial,auto_renew) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
          [item.id, item.tenantId, item.planId, item.status, item.startDate, item.endDate, !!item.trial, !!item.autoRenew],
        );
      }

      for (const item of input.platformUsers ?? []) {
        await client.query(
          "INSERT INTO platform_users (id,username,phone,role_key,status,note) VALUES ($1,$2,$3,$4,$5,$6)",
          [item.id, item.username, item.phone, item.roleKey, item.status, item.note],
        );
      }

      for (const item of input.tenantUsers ?? []) {
        await client.query(
          "INSERT INTO tenant_users (id,tenant_id,username,phone,role_key,status,sms_enabled,message_types,note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)",
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
          "INSERT INTO tenant_devices (id,tenant_id,name,type,area,installation_location,status,last_report_at,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
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
          "INSERT INTO tenant_alarms (id,tenant_id,device_id,device_name,location,alarm_type,time,process_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
          [item.id, item.tenantId, item.deviceId, item.deviceName, item.location, item.alarmType, item.time, item.processStatus],
        );
      }

      for (const item of input.notificationSettings ?? []) {
        await client.query(
          "INSERT INTO notification_settings (id,tenant_id,alarm_threshold,notification_enabled,map_placeholder,remark) VALUES ($1,$2,$3,$4,$5,$6)",
          [item.id, item.tenantId, item.alarmThreshold, !!item.notificationEnabled, item.mapPlaceholder, item.remark],
        );
      }

      for (const item of input.quotaUsage ?? []) {
        await client.query(
          "INSERT INTO quota_usage (id,tenant_id,device_count,user_count,sms_used) VALUES ($1,$2,$3,$4,$5)",
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

export async function listTenantUsers(tenantId: string) {
  return (await allReady<any>("SELECT * FROM tenant_users WHERE tenant_id = $1 ORDER BY username ASC", [tenantId])).map(
    mapTenantUser,
  );
}

export async function upsertTenantUser(tenantId: string, input: any) {
  await ensureDatabase();
  const id = input.id ?? `tenant-user-${Date.now()}`;
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
    [id, tenantId, input.username, input.phone, input.roleKey, input.status, !!input.smsEnabled, JSON.stringify(input.messageTypes ?? []), input.note ?? ""],
  );

  return mapTenantUser(await getReady<any>("SELECT * FROM tenant_users WHERE id = $1", [id]));
}

export async function deleteTenantUser(tenantId: string, id: string) {
  await queryReady("DELETE FROM tenant_users WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
}

export async function listTenantDevices(tenantId: string) {
  return (await allReady<any>("SELECT * FROM tenant_devices WHERE tenant_id = $1 ORDER BY name ASC", [tenantId])).map(
    mapTenantDevice,
  );
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
    [id, tenantId, input.name, input.type, input.area, input.installationLocation, input.status, input.lastReportAt, input.notes ?? ""],
  );

  return mapTenantDevice(await getReady<any>("SELECT * FROM tenant_devices WHERE id = $1", [id]));
}

export async function deleteTenantDevice(tenantId: string, id: string) {
  await queryReady("DELETE FROM tenant_devices WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
}

export function getDatabasePath() {
  return DATABASE_URL ?? "";
}
