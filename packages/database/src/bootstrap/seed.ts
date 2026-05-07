import type { PoolClient } from "pg";
import { hashPassword } from "../../../../lib/password";
import {
  ALARM_PROCESS_RESOLVED,
  ALARM_WORKFLOW_CLOSED,
  ALARM_WORKFLOW_COMPLETED,
  ALARM_WORKFLOW_PENDING,
  ALARM_WORKFLOW_PROCESSING,
} from "../repositories/_shared";

export async function seedDemoCoreData(client: PoolClient) {
  const existing = await client.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM tenants");
  if (Number(existing.rows[0]?.count ?? 0) > 0) {
    return;
  }

  await client.query(`
    INSERT INTO tenants (id, name, code, industry, contact_name, contact_phone, status, created_at, note) VALUES
    ('tenant-huaxing', '华星制造', 'HX-001', '制造业', '陈志远', '13800110001', '启用', '2026-01-08', '已接入 2 个厂区，后续计划接入维保模块。'),
    ('tenant-anhe', '安和商业中心', 'AH-002', '商业综合体', '刘晓敏', '13800110002', '启用', '2026-02-15', '重点关注报警中心与大屏态势。')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO tenant_device_attribute_definitions (
      tenant_id, field_key, label, field_type, required, enabled, show_in_list, sort_order, is_core
    )
    SELECT t.id, d.field_key, d.label, d.field_type, d.required, d.enabled, d.show_in_list, d.sort_order, d.is_core
    FROM tenants t
    CROSS JOIN (
      VALUES
        ('deviceCode', '设备编码', 'text', TRUE, TRUE, TRUE, 10, TRUE),
        ('name', '设备名称', 'text', TRUE, TRUE, TRUE, 20, TRUE),
        ('type', '设备类型', 'text', TRUE, TRUE, TRUE, 30, TRUE),
        ('area', '所属区域/楼层', 'text', TRUE, TRUE, TRUE, 40, TRUE),
        ('installationLocation', '安装位置', 'text', TRUE, TRUE, TRUE, 50, TRUE),
        ('installationStatus', '安装状态', 'text', FALSE, TRUE, TRUE, 60, TRUE),
        ('status', '实时状态', 'text', FALSE, TRUE, TRUE, 70, TRUE),
        ('lastReportAt', '最近上报时间', 'date', FALSE, TRUE, FALSE, 80, TRUE),
        ('notes', '备注', 'text', FALSE, TRUE, FALSE, 90, TRUE)
    ) AS d(field_key, label, field_type, required, enabled, show_in_list, sort_order, is_core)
    ON CONFLICT (tenant_id, field_key) DO NOTHING;

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

    INSERT INTO login_accounts (id, username, password, password_hash, display_name, scope, role_key, tenant_id, must_change_password) VALUES
    ('account-platform-1', 'platform_admin', '', '${hashPassword("Admin123456")}', '平台超级管理员', 'platform', 'platform_super_admin', NULL, false),
    ('account-tenant-hx-1', 'hx_admin', '', '${hashPassword("Hx123456")}', '华星制造管理员', 'tenant', 'tenant_level_1', 'tenant-huaxing', true),
    ('account-tenant-ah-1', 'ah_admin', '', '${hashPassword("Ah123456")}', '安和商业中心管理员', 'tenant', 'tenant_level_1', 'tenant-anhe', true)
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
    ('alarm-hx-2', 'tenant-huaxing', 'device-hx-3', '消防泵压力监测 A-301', '泵房 / 北侧泵房', '设备故障', '2026-04-20 08:55:10', '已处理'),
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

export async function seedDemoSpatialData(client: PoolClient) {
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
    ('building-hx-pump', 'tenant-huaxing', 'site-hx-main', '消防泵房', 'HX-P', 1, '动力保障'),
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

    UPDATE tenant_drawings d
    SET building_id = f.building_id
    FROM tenant_floors f
    WHERE d.tenant_id = f.tenant_id AND d.floor_id = f.id AND d.building_id = '';

    UPDATE tenant_device_points p
    SET building_id = COALESCE(NULLIF(d.building_id, ''), f.building_id, '')
    FROM tenant_drawings d
    LEFT JOIN tenant_floors f ON f.tenant_id = d.tenant_id AND f.id = d.floor_id
    WHERE p.tenant_id = d.tenant_id AND p.drawing_id = d.id AND p.building_id = '';

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

async function repairAlarmWorkflowFromLogs(client: PoolClient) {
  await client.query(
    `WITH latest_workflow_log AS (
       SELECT DISTINCT ON (tenant_id, alarm_id)
         tenant_id,
         alarm_id,
         to_status,
         operator_name,
         created_at
       FROM alarm_logs
       WHERE to_status IS NOT NULL
         AND to_status <> ''
       ORDER BY tenant_id, alarm_id, created_at DESC, id DESC
     )
     UPDATE tenant_alarms AS alarm
     SET workflow_status = latest.to_status,
         process_status = CASE
           WHEN latest.to_status IN ($1, $2) THEN $3
           WHEN latest.to_status = $4 THEN $4
           ELSE $5
         END,
         last_operator_name = COALESCE(NULLIF(latest.operator_name, ''), alarm.last_operator_name),
         completed_at = CASE
           WHEN latest.to_status = $1 AND alarm.completed_at IS NULL THEN latest.created_at
           ELSE alarm.completed_at
         END,
         closed_at = CASE
           WHEN latest.to_status = $2 AND alarm.closed_at IS NULL THEN latest.created_at
           ELSE alarm.closed_at
         END
     FROM latest_workflow_log AS latest
     WHERE alarm.tenant_id = latest.tenant_id
       AND alarm.id = latest.alarm_id
       AND alarm.workflow_status IS DISTINCT FROM latest.to_status`,
    [
      ALARM_WORKFLOW_COMPLETED,
      ALARM_WORKFLOW_CLOSED,
      ALARM_PROCESS_RESOLVED,
      ALARM_WORKFLOW_PROCESSING,
      ALARM_WORKFLOW_PENDING,
    ],
  );
}

export async function seedOperationalDefaults(client: PoolClient) {
  await client.query(
    `UPDATE tenant_alarms
     SET workflow_status = CASE
       WHEN process_status IN ('处理中', '待确认') THEN '处理中'
       WHEN process_status IN ('已处理', '已完成') THEN '已完成'
       ELSE '未处理'
     END
     WHERE workflow_status IS NULL OR workflow_status = '' OR workflow_status IN ('未处理', '处理中', '已完成')`,
  );

  await repairAlarmWorkflowFromLogs(client);

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
      ('inspect-ah-1', 'tenant-anhe', 'B2车库周巡检', 'weekly', 'area', 'floor-ah-g-2', 'B2车库', '2026-04-23', 'ah_admin', 'pending', '检查离线手报与疏散通道设施', '2026-04-22 18:00:00')
    ON CONFLICT (id) DO NOTHING;
  `);

  await client.query(`
    INSERT INTO maintenance_records (id, tenant_id, device_id, device_name, vendor_name, maintenance_date, next_due_date, result, note) VALUES
      ('maint-hx-1', 'tenant-huaxing', 'device-hx-3', '消防泵压力监测 A-301', '苏州维保中心', '2026-04-10', '2026-05-10', '待复检', '压力传感器更换后待验收'),
      ('maint-ah-1', 'tenant-anhe', 'device-ah-2', '地下车库手报 B-204', '杭州维保站', '2026-04-08', '2026-05-08', '处理中', '排查离线线路与模块状态')
    ON CONFLICT (id) DO NOTHING;
  `);
}
