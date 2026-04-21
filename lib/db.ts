/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const storageDir = path.join(process.cwd(), "storage");
const databasePath = path.join(storageDir, "smart-fire.db");
const databaseLockPath = path.join(storageDir, "smart-fire.db.lock");

fs.mkdirSync(storageDir, { recursive: true });

function toJson(value: unknown) {
  return JSON.stringify(value);
}

function fromJsonArray(value: string | null | undefined) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sleepSync(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function createSchema(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS login_accounts (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      display_name TEXT NOT NULL,
      scope TEXT NOT NULL,
      role_key TEXT NOT NULL,
      tenant_id TEXT
    )
  `);

  database.exec(`
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
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL,
      price_monthly INTEGER NOT NULL,
      max_devices INTEGER NOT NULL,
      max_users INTEGER NOT NULL,
      sms_quota INTEGER NOT NULL,
      feature_keys TEXT NOT NULL,
      description TEXT NOT NULL
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      status TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      trial INTEGER NOT NULL,
      auto_renew INTEGER NOT NULL
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS platform_users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      role_key TEXT NOT NULL,
      status TEXT NOT NULL,
      note TEXT NOT NULL
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS tenant_users (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      username TEXT NOT NULL,
      phone TEXT NOT NULL,
      role_key TEXT NOT NULL,
      status TEXT NOT NULL,
      sms_enabled INTEGER NOT NULL,
      message_types TEXT NOT NULL,
      note TEXT NOT NULL
    )
  `);

  database.exec(`
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
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS tenant_alarms (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      device_name TEXT NOT NULL,
      location TEXT NOT NULL,
      alarm_type TEXT NOT NULL,
      time TEXT NOT NULL,
      process_status TEXT NOT NULL
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS notification_settings (
      id TEXT PRIMARY KEY,
      tenant_id TEXT UNIQUE NOT NULL,
      alarm_threshold TEXT NOT NULL,
      notification_enabled INTEGER NOT NULL,
      map_placeholder TEXT NOT NULL,
      remark TEXT NOT NULL
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS quota_usage (
      id TEXT PRIMARY KEY,
      tenant_id TEXT UNIQUE NOT NULL,
      device_count INTEGER NOT NULL,
      user_count INTEGER NOT NULL,
      sms_used INTEGER NOT NULL
    )
  `);
}

function seedIfEmpty(database: DatabaseSync) {
  const existing = database.prepare("SELECT COUNT(*) as count FROM tenants").get() as { count: number };
  if ((existing?.count ?? 0) > 0) {
    return;
  }

  database.exec("BEGIN");
  try {
    const tenants = [
      ["tenant-huaxing", "华星制造", "HX-001", "制造业", "陈志远", "13800110001", "启用", "2026-01-08", "已接入 2 个厂区，后续计划接入维保模块。"],
      ["tenant-anhe", "安和商业中心", "AH-002", "商业综合体", "刘晓敏", "13800110002", "启用", "2026-02-15", "关注报警中心与大屏态势。"],
    ];
    const insertTenant = database.prepare(
      "INSERT INTO tenants (id,name,code,industry,contact_name,contact_phone,status,created_at,note) VALUES (?,?,?,?,?,?,?,?,?)",
    );
    tenants.forEach((item) => insertTenant.run(...item));

    const plans = [
      ["plan-basic", "基础版", "basic", "启用", 1999, 100, 20, 500, toJson(["dashboard", "alarm_center", "device_management", "user_management", "settings"]), "适合中小型企业，覆盖基础监控、报警与设备管理能力。"],
      ["plan-pro", "专业版", "pro", "启用", 4999, 500, 80, 3000, toJson(["dashboard", "alarm_center", "device_management", "user_management", "settings", "advanced_reports", "maintenance"]), "提供高级报表与巡检维保，适合多园区、多班组企业。"],
      ["plan-enterprise", "企业版", "enterprise", "启用", 9999, 2000, 300, 12000, toJson(["dashboard", "alarm_center", "device_management", "user_management", "settings", "advanced_reports", "maintenance", "api_access"]), "面向集团客户，提供 API 对接与高配额能力。"],
    ];
    const insertPlan = database.prepare(
      "INSERT INTO plans (id,name,code,status,price_monthly,max_devices,max_users,sms_quota,feature_keys,description) VALUES (?,?,?,?,?,?,?,?,?,?)",
    );
    plans.forEach((item) => insertPlan.run(...item));

    const subscriptions = [
      ["sub-1", "tenant-huaxing", "plan-enterprise", "已生效", "2026-01-10", "2027-01-09", 0, 1],
      ["sub-2", "tenant-anhe", "plan-pro", "试用中", "2026-04-01", "2026-05-01", 1, 0],
    ];
    const insertSubscription = database.prepare(
      "INSERT INTO subscriptions (id,tenant_id,plan_id,status,start_date,end_date,trial,auto_renew) VALUES (?,?,?,?,?,?,?,?)",
    );
    subscriptions.forEach((item) => insertSubscription.run(...item));

    const platformUsers = [
      ["platform-user-1", "super.admin", "13900110001", "platform_super_admin", "启用", "平台最高权限账号。"],
    ];
    const insertPlatformUser = database.prepare(
      "INSERT INTO platform_users (id,username,phone,role_key,status,note) VALUES (?,?,?,?,?,?)",
    );
    platformUsers.forEach((item) => insertPlatformUser.run(...item));

    const tenantUsers = [
      ["tenant-user-1", "tenant-huaxing", "hx_admin", "13700000001", "tenant_level_1", "启用", 1, toJson(["报警信息", "故障信息"]), "华星制造总值班负责人。"],
      ["tenant-user-2", "tenant-huaxing", "hx_duty", "13700000002", "tenant_level_2", "启用", 1, toJson(["报警信息"]), "华星制造中控室值班员。"],
      ["tenant-user-3", "tenant-anhe", "ah_admin", "13700000003", "tenant_level_1", "启用", 1, toJson(["报警信息", "故障信息"]), "安和商业中心管理员。"],
    ];
    const insertTenantUser = database.prepare(
      "INSERT INTO tenant_users (id,tenant_id,username,phone,role_key,status,sms_enabled,message_types,note) VALUES (?,?,?,?,?,?,?,?,?)",
    );
    tenantUsers.forEach((item) => insertTenantUser.run(...item));

    const loginAccounts = [
      ["account-platform-1", "platform_admin", "Admin123456", "平台超级管理员", "platform", "platform_super_admin", null],
      ["account-tenant-hx-1", "hx_admin", "Hx123456", "华星制造管理员", "tenant", "tenant_level_1", "tenant-huaxing"],
      ["account-tenant-ah-1", "ah_admin", "Ah123456", "安和商业中心管理员", "tenant", "tenant_level_1", "tenant-anhe"],
    ];
    const insertLogin = database.prepare(
      "INSERT INTO login_accounts (id,username,password,display_name,scope,role_key,tenant_id) VALUES (?,?,?,?,?,?,?)",
    );
    loginAccounts.forEach((item) => insertLogin.run(...item));

    const tenantDevices = [
      ["device-hx-1", "tenant-huaxing", "1号厂房烟感 A-101", "烟雾探测器", "1号厂房", "东侧配电区", "报警", "2026-04-20 09:12:45", "今日 09:12 触发烟雾报警，等待现场核查。"],
      ["device-hx-2", "tenant-huaxing", "喷淋联动模块 A-208", "联动控制模块", "2号厂房", "主走廊", "正常", "2026-04-20 09:03:11", "运行稳定。"],
      ["device-hx-3", "tenant-huaxing", "消防泵压力监测 A-301", "水压监测器", "泵房", "北侧泵房", "故障", "2026-04-20 08:55:10", "设备自检异常，待维护。"],
      ["device-ah-1", "tenant-anhe", "中庭烟感 B-101", "烟雾探测器", "商业中庭", "一层中庭", "正常", "2026-04-20 09:05:12", "状态正常。"],
      ["device-ah-2", "tenant-anhe", "地下车库手报 B-204", "手动报警按钮", "地下车库", "B2 电梯前室", "离线", "2026-04-20 07:18:20", "网络链路中断。"],
    ];
    const insertDevice = database.prepare(
      "INSERT INTO tenant_devices (id,tenant_id,name,type,area,installation_location,status,last_report_at,notes) VALUES (?,?,?,?,?,?,?,?,?)",
    );
    tenantDevices.forEach((item) => insertDevice.run(...item));

    const alarms = [
      ["alarm-hx-1", "tenant-huaxing", "device-hx-1", "1号厂房烟感 A-101", "1号厂房 / 东侧配电区", "烟感触发报警", "2026-04-20 09:12:45", "未处理"],
      ["alarm-hx-2", "tenant-huaxing", "device-hx-3", "消防泵压力监测 A-301", "泵房 / 北侧泵房", "故障报警", "2026-04-20 08:55:10", "处理中"],
      ["alarm-ah-1", "tenant-anhe", "device-ah-2", "地下车库手报 B-204", "地下车库 / B2 电梯前室", "设备离线", "2026-04-20 07:18:20", "未处理"],
    ];
    const insertAlarm = database.prepare(
      "INSERT INTO tenant_alarms (id,tenant_id,device_id,device_name,location,alarm_type,time,process_status) VALUES (?,?,?,?,?,?,?,?)",
    );
    alarms.forEach((item) => insertAlarm.run(...item));

    const notificationSettings = [
      ["notify-hx", "tenant-huaxing", "烟雾浓度 > 75 ppm", 1, "华星制造园区总图 V1", "短信通知发送到总值班负责人和巡检主管。"],
      ["notify-ah", "tenant-anhe", "烟感连续 10 秒触发报警", 1, "安和商业中心楼层图 V3", "商业中庭与车库为重点关注区域。"],
    ];
    const insertNotification = database.prepare(
      "INSERT INTO notification_settings (id,tenant_id,alarm_threshold,notification_enabled,map_placeholder,remark) VALUES (?,?,?,?,?,?)",
    );
    notificationSettings.forEach((item) => insertNotification.run(...item));

    const quotaUsages = [
      ["quota-hx", "tenant-huaxing", 328, 34, 980],
      ["quota-ah", "tenant-anhe", 146, 18, 420],
    ];
    const insertQuota = database.prepare(
      "INSERT INTO quota_usage (id,tenant_id,device_count,user_count,sms_used) VALUES (?,?,?,?,?)",
    );
    quotaUsages.forEach((item) => insertQuota.run(...item));

    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function initializeDatabase() {
  while (true) {
    try {
      const fd = fs.openSync(databaseLockPath, "wx");
      fs.closeSync(fd);
      try {
        const setupDb = new DatabaseSync(databasePath);
        createSchema(setupDb);
        seedIfEmpty(setupDb);
        setupDb.close();
      } finally {
        fs.unlinkSync(databaseLockPath);
      }
      break;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException)?.code !== "EEXIST") {
        throw error;
      }
      sleepSync(25);
    }
  }
}

initializeDatabase();

const db = new DatabaseSync(databasePath);

function run(sql: string, ...params: unknown[]) {
  return db.prepare(sql).run(...params);
}

function get<T>(sql: string, ...params: unknown[]) {
  return db.prepare(sql).get(...params) as T | undefined;
}

function all<T>(sql: string, ...params: unknown[]) {
  return db.prepare(sql).all(...params) as T[];
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
    priceMonthly: row.price_monthly,
    maxDevices: row.max_devices,
    maxUsers: row.max_users,
    smsQuota: row.sms_quota,
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
    deviceCount: row.device_count,
    userCount: row.user_count,
    smsUsed: row.sms_used,
  };
}

export async function findLoginAccount(username: string, password: string) {
  const row = get<any>(
    "SELECT * FROM login_accounts WHERE username = ? AND password = ? LIMIT 1",
    username,
    password,
  );
  if (!row) return null;
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
  run("UPDATE login_accounts SET password = ? WHERE username = ?", nextPassword, username);
}

export async function getTenantById(tenantId?: string) {
  if (!tenantId) return null;
  const row = get<any>("SELECT * FROM tenants WHERE id = ?", tenantId);
  return row ? mapTenant(row) : null;
}

export async function getPlatformOverview() {
  return {
    tenants: all<any>("SELECT * FROM tenants ORDER BY created_at ASC").map(mapTenant),
    plans: all<any>("SELECT * FROM plans ORDER BY name ASC").map(mapPlan),
    subscriptions: all<any>("SELECT * FROM subscriptions ORDER BY start_date DESC").map(mapSubscription),
    platformUsers: all<any>("SELECT * FROM platform_users ORDER BY username ASC").map(mapPlatformUser),
  };
}

export async function getTenantOverview(tenantId: string) {
  const tenant = await getTenantById(tenantId);
  const subscriptionRow = get<any>("SELECT * FROM subscriptions WHERE tenant_id = ? LIMIT 1", tenantId);
  const subscription = subscriptionRow ? mapSubscription(subscriptionRow) : null;
  const planRow = subscription ? get<any>("SELECT * FROM plans WHERE id = ? LIMIT 1", subscription.planId) : undefined;

  return {
    tenant,
    subscription,
    plan: planRow ? mapPlan(planRow) : null,
    devices: all<any>("SELECT * FROM tenant_devices WHERE tenant_id = ? ORDER BY name ASC", tenantId).map(mapTenantDevice),
    alarms: all<any>("SELECT * FROM tenant_alarms WHERE tenant_id = ? ORDER BY time DESC", tenantId).map(mapAlarm),
    users: all<any>("SELECT * FROM tenant_users WHERE tenant_id = ? ORDER BY username ASC", tenantId).map(mapTenantUser),
    settings: (() => {
      const row = get<any>("SELECT * FROM notification_settings WHERE tenant_id = ? LIMIT 1", tenantId);
      return row ? mapNotification(row) : null;
    })(),
    quota: (() => {
      const row = get<any>("SELECT * FROM quota_usage WHERE tenant_id = ? LIMIT 1", tenantId);
      return row ? mapQuota(row) : null;
    })(),
  };
}

export async function getAdminState() {
  return {
    tenants: all<any>("SELECT * FROM tenants ORDER BY created_at ASC").map(mapTenant),
    plans: all<any>("SELECT * FROM plans ORDER BY name ASC").map(mapPlan),
    subscriptions: all<any>("SELECT * FROM subscriptions ORDER BY start_date DESC").map(mapSubscription),
    platformUsers: all<any>("SELECT * FROM platform_users ORDER BY username ASC").map(mapPlatformUser),
    tenantUsers: all<any>("SELECT * FROM tenant_users ORDER BY tenant_id ASC, username ASC").map(mapTenantUser),
    tenantDevices: all<any>("SELECT * FROM tenant_devices ORDER BY tenant_id ASC, name ASC").map(mapTenantDevice),
    tenantAlarms: all<any>("SELECT * FROM tenant_alarms ORDER BY time DESC").map(mapAlarm),
    notificationSettings: all<any>("SELECT * FROM notification_settings ORDER BY tenant_id ASC").map(mapNotification),
    quotaUsage: all<any>("SELECT * FROM quota_usage ORDER BY tenant_id ASC").map(mapQuota),
  };
}

export async function replaceAdminState(input: any) {
  db.exec("BEGIN");
  try {
    db.exec(`
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

    (input.tenants ?? []).forEach((item: any) => {
      run(
        "INSERT INTO tenants (id,name,code,industry,contact_name,contact_phone,status,created_at,note) VALUES (?,?,?,?,?,?,?,?,?)",
        item.id,
        item.name,
        item.code,
        item.industry,
        item.contactName,
        item.contactPhone,
        item.status,
        item.createdAt,
        item.note,
      );
    });

    (input.plans ?? []).forEach((item: any) => {
      run(
        "INSERT INTO plans (id,name,code,status,price_monthly,max_devices,max_users,sms_quota,feature_keys,description) VALUES (?,?,?,?,?,?,?,?,?,?)",
        item.id,
        item.name,
        item.code,
        item.status,
        item.priceMonthly,
        item.maxDevices,
        item.maxUsers,
        item.smsQuota,
        toJson(item.featureKeys ?? []),
        item.description,
      );
    });

    (input.subscriptions ?? []).forEach((item: any) => {
      run(
        "INSERT INTO subscriptions (id,tenant_id,plan_id,status,start_date,end_date,trial,auto_renew) VALUES (?,?,?,?,?,?,?,?)",
        item.id,
        item.tenantId,
        item.planId,
        item.status,
        item.startDate,
        item.endDate,
        item.trial ? 1 : 0,
        item.autoRenew ? 1 : 0,
      );
    });

    (input.platformUsers ?? []).forEach((item: any) => {
      run(
        "INSERT INTO platform_users (id,username,phone,role_key,status,note) VALUES (?,?,?,?,?,?)",
        item.id,
        item.username,
        item.phone,
        item.roleKey,
        item.status,
        item.note,
      );
    });

    (input.tenantUsers ?? []).forEach((item: any) => {
      run(
        "INSERT INTO tenant_users (id,tenant_id,username,phone,role_key,status,sms_enabled,message_types,note) VALUES (?,?,?,?,?,?,?,?,?)",
        item.id,
        item.tenantId,
        item.username,
        item.phone,
        item.roleKey,
        item.status,
        item.smsEnabled ? 1 : 0,
        toJson(item.messageTypes ?? []),
        item.note,
      );
    });

    (input.tenantDevices ?? []).forEach((item: any) => {
      run(
        "INSERT INTO tenant_devices (id,tenant_id,name,type,area,installation_location,status,last_report_at,notes) VALUES (?,?,?,?,?,?,?,?,?)",
        item.id,
        item.tenantId,
        item.name,
        item.type,
        item.area,
        item.installationLocation,
        item.status,
        item.lastReportAt,
        item.notes,
      );
    });

    (input.tenantAlarms ?? []).forEach((item: any) => {
      run(
        "INSERT INTO tenant_alarms (id,tenant_id,device_id,device_name,location,alarm_type,time,process_status) VALUES (?,?,?,?,?,?,?,?)",
        item.id,
        item.tenantId,
        item.deviceId,
        item.deviceName,
        item.location,
        item.alarmType,
        item.time,
        item.processStatus,
      );
    });

    (input.notificationSettings ?? []).forEach((item: any) => {
      run(
        "INSERT INTO notification_settings (id,tenant_id,alarm_threshold,notification_enabled,map_placeholder,remark) VALUES (?,?,?,?,?,?)",
        item.id,
        item.tenantId,
        item.alarmThreshold,
        item.notificationEnabled ? 1 : 0,
        item.mapPlaceholder,
        item.remark,
      );
    });

    (input.quotaUsage ?? []).forEach((item: any) => {
      run(
        "INSERT INTO quota_usage (id,tenant_id,device_count,user_count,sms_used) VALUES (?,?,?,?,?)",
        item.id,
        item.tenantId,
        item.deviceCount,
        item.userCount,
        item.smsUsed,
      );
    });

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export async function listTenantUsers(tenantId: string) {
  return all<any>("SELECT * FROM tenant_users WHERE tenant_id = ? ORDER BY username ASC", tenantId).map(mapTenantUser);
}

export async function upsertTenantUser(tenantId: string, input: any) {
  const id = input.id ?? `tenant-user-${Date.now()}`;
  const exists = get<any>("SELECT id FROM tenant_users WHERE id = ?", id);

  if (exists) {
    run(
      "UPDATE tenant_users SET username = ?, phone = ?, role_key = ?, status = ?, sms_enabled = ?, message_types = ?, note = ? WHERE id = ? AND tenant_id = ?",
      input.username,
      input.phone,
      input.roleKey,
      input.status,
      input.smsEnabled ? 1 : 0,
      toJson(input.messageTypes ?? []),
      input.note ?? "",
      id,
      tenantId,
    );
  } else {
    run(
      "INSERT INTO tenant_users (id,tenant_id,username,phone,role_key,status,sms_enabled,message_types,note) VALUES (?,?,?,?,?,?,?,?,?)",
      id,
      tenantId,
      input.username,
      input.phone,
      input.roleKey,
      input.status,
      input.smsEnabled ? 1 : 0,
      toJson(input.messageTypes ?? []),
      input.note ?? "",
    );
  }

  return mapTenantUser(get<any>("SELECT * FROM tenant_users WHERE id = ?", id));
}

export async function deleteTenantUser(tenantId: string, id: string) {
  run("DELETE FROM tenant_users WHERE id = ? AND tenant_id = ?", id, tenantId);
}

export async function listTenantDevices(tenantId: string) {
  return all<any>("SELECT * FROM tenant_devices WHERE tenant_id = ? ORDER BY name ASC", tenantId).map(mapTenantDevice);
}

export async function upsertTenantDevice(tenantId: string, input: any) {
  const id = input.id ?? `device-${Date.now()}`;
  const exists = get<any>("SELECT id FROM tenant_devices WHERE id = ?", id);

  if (exists) {
    run(
      "UPDATE tenant_devices SET name = ?, type = ?, area = ?, installation_location = ?, status = ?, last_report_at = ?, notes = ? WHERE id = ? AND tenant_id = ?",
      input.name,
      input.type,
      input.area,
      input.installationLocation,
      input.status,
      input.lastReportAt,
      input.notes ?? "",
      id,
      tenantId,
    );
  } else {
    run(
      "INSERT INTO tenant_devices (id,tenant_id,name,type,area,installation_location,status,last_report_at,notes) VALUES (?,?,?,?,?,?,?,?,?)",
      id,
      tenantId,
      input.name,
      input.type,
      input.area,
      input.installationLocation,
      input.status,
      input.lastReportAt,
      input.notes ?? "",
    );
  }

  return mapTenantDevice(get<any>("SELECT * FROM tenant_devices WHERE id = ?", id));
}

export async function deleteTenantDevice(tenantId: string, id: string) {
  run("DELETE FROM tenant_devices WHERE id = ? AND tenant_id = ?", id, tenantId);
}

export function getDatabasePath() {
  return databasePath;
}
