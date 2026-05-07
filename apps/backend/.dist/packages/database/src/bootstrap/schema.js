"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyBaseSchema = applyBaseSchema;
exports.migratePasswordHashes = migratePasswordHashes;
const password_1 = require("../../../../lib/password");
async function applyBaseSchema(client) {
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
    ALTER TABLE tenant_devices ADD COLUMN IF NOT EXISTS device_code TEXT NOT NULL DEFAULT '';
    ALTER TABLE tenant_devices ADD COLUMN IF NOT EXISTS installation_status TEXT NOT NULL DEFAULT '';
    ALTER TABLE tenant_devices ADD COLUMN IF NOT EXISTS custom_attributes JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE tenant_devices ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'active';
    ALTER TABLE tenant_devices ADD COLUMN IF NOT EXISTS disabled_at TEXT;
    ALTER TABLE tenant_devices ADD COLUMN IF NOT EXISTS disabled_reason TEXT NOT NULL DEFAULT '';
    CREATE UNIQUE INDEX IF NOT EXISTS tenant_devices_tenant_device_code_idx
      ON tenant_devices (tenant_id, device_code)
      WHERE device_code <> '';
    CREATE INDEX IF NOT EXISTS tenant_devices_tenant_lifecycle_idx
      ON tenant_devices (tenant_id, lifecycle_status);

    CREATE TABLE IF NOT EXISTS tenant_device_attribute_definitions (
      tenant_id TEXT NOT NULL,
      field_key TEXT NOT NULL,
      label TEXT NOT NULL,
      field_type TEXT NOT NULL,
      required BOOLEAN NOT NULL DEFAULT FALSE,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      show_in_list BOOLEAN NOT NULL DEFAULT FALSE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_core BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (tenant_id, field_key)
    );

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
      usage_type TEXT NOT NULL,
      area_type TEXT NOT NULL DEFAULT 'building',
      has_floors BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      description TEXT NOT NULL DEFAULT ''
    );
    ALTER TABLE tenant_buildings ADD COLUMN IF NOT EXISTS area_type TEXT NOT NULL DEFAULT 'building';
    ALTER TABLE tenant_buildings ADD COLUMN IF NOT EXISTS has_floors BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE tenant_buildings ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE tenant_buildings ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
    ALTER TABLE tenant_buildings ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
    UPDATE tenant_buildings
    SET area_type = CASE WHEN area_type = '' THEN COALESCE(NULLIF(usage_type, ''), 'building') ELSE area_type END;

    CREATE TABLE IF NOT EXISTS tenant_floors (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      building_id TEXT NOT NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      level_index INTEGER NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      description TEXT NOT NULL
    );
    ALTER TABLE tenant_floors ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE tenant_floors ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
    UPDATE tenant_floors SET sort_order = level_index WHERE sort_order = 0;

    CREATE TABLE IF NOT EXISTS tenant_drawings (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      building_id TEXT NOT NULL DEFAULT '',
      floor_id TEXT NOT NULL,
      name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      version TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    ALTER TABLE tenant_drawings ADD COLUMN IF NOT EXISTS building_id TEXT NOT NULL DEFAULT '';
    ALTER TABLE tenant_drawings ADD COLUMN IF NOT EXISTS file_type TEXT NOT NULL DEFAULT 'image';
    ALTER TABLE tenant_drawings ADD COLUMN IF NOT EXISTS source_file_url TEXT NOT NULL DEFAULT '';
    ALTER TABLE tenant_drawings ADD COLUMN IF NOT EXISTS preview_url TEXT NOT NULL DEFAULT '';
    ALTER TABLE tenant_drawings ADD COLUMN IF NOT EXISTS original_file_name TEXT NOT NULL DEFAULT '';
    ALTER TABLE tenant_drawings ADD COLUMN IF NOT EXISTS file_size INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE tenant_drawings ADD COLUMN IF NOT EXISTS published_at TEXT;
    ALTER TABLE tenant_drawings ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'ready';
    ALTER TABLE tenant_drawings ADD COLUMN IF NOT EXISTS processing_message TEXT NOT NULL DEFAULT '';
    ALTER TABLE tenant_drawings ADD COLUMN IF NOT EXISTS conversion_log JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE tenant_drawings ADD COLUMN IF NOT EXISTS scene_url TEXT NOT NULL DEFAULT '';
    UPDATE tenant_drawings d
    SET building_id = f.building_id
    FROM tenant_floors f
    WHERE d.tenant_id = f.tenant_id AND d.floor_id = f.id AND d.building_id = '';

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
      building_id TEXT NOT NULL DEFAULT '',
      floor_id TEXT NOT NULL,
      drawing_id TEXT NOT NULL,
      x DOUBLE PRECISION NOT NULL,
      y DOUBLE PRECISION NOT NULL,
      rotation DOUBLE PRECISION NOT NULL DEFAULT 0,
      icon TEXT NOT NULL,
      status_style TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    ALTER TABLE tenant_device_points ADD COLUMN IF NOT EXISTS building_id TEXT NOT NULL DEFAULT '';
    UPDATE tenant_device_points p
    SET building_id = COALESCE(NULLIF(d.building_id, ''), f.building_id, '')
    FROM tenant_drawings d
    LEFT JOIN tenant_floors f ON f.tenant_id = d.tenant_id AND f.id = d.floor_id
    WHERE p.tenant_id = d.tenant_id AND p.drawing_id = d.id AND p.building_id = '';

    CREATE TABLE IF NOT EXISTS raw_device_events (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      gateway_id TEXT,
      event_id TEXT,
      dedupe_key TEXT,
      protocol TEXT NOT NULL DEFAULT 'http',
      event_type TEXT NOT NULL,
      event_code TEXT NOT NULL,
      event_level TEXT NOT NULL,
      payload JSONB NOT NULL,
      raw_payload JSONB,
      processing_status TEXT NOT NULL DEFAULT 'processed',
      processed_at TEXT,
      reported_at TEXT NOT NULL
    );

    ALTER TABLE raw_device_events ADD COLUMN IF NOT EXISTS event_id TEXT;
    ALTER TABLE raw_device_events ADD COLUMN IF NOT EXISTS dedupe_key TEXT;
    ALTER TABLE raw_device_events ADD COLUMN IF NOT EXISTS protocol TEXT NOT NULL DEFAULT 'http';
    ALTER TABLE raw_device_events ADD COLUMN IF NOT EXISTS raw_payload JSONB;
    ALTER TABLE raw_device_events ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'processed';
    ALTER TABLE raw_device_events ADD COLUMN IF NOT EXISTS processed_at TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS raw_device_events_dedupe_key_idx ON raw_device_events (dedupe_key);

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

    CREATE TABLE IF NOT EXISTS platform_notices (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      level TEXT NOT NULL,
      target_mode TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'sent',
      sender_name TEXT NOT NULL,
      sender_role TEXT NOT NULL,
      target_tenant_count INTEGER NOT NULL DEFAULT 0,
      target_tenant_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
      revoked_at TEXT,
      deleted_at TEXT,
      revoke_reason TEXT,
      request_id TEXT,
      updated_at TEXT,
      published_at TEXT,
      created_at TEXT NOT NULL
    );
    ALTER TABLE platform_notices ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE platform_notices ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'sent';
    ALTER TABLE platform_notices ADD COLUMN IF NOT EXISTS target_tenant_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE platform_notices ADD COLUMN IF NOT EXISTS revoked_at TEXT;
    ALTER TABLE platform_notices ADD COLUMN IF NOT EXISTS deleted_at TEXT;
    ALTER TABLE platform_notices ADD COLUMN IF NOT EXISTS revoke_reason TEXT;
    ALTER TABLE platform_notices ADD COLUMN IF NOT EXISTS request_id TEXT;
    ALTER TABLE platform_notices ADD COLUMN IF NOT EXISTS updated_at TEXT;
    ALTER TABLE platform_notices ADD COLUMN IF NOT EXISTS published_at TEXT;

    UPDATE platform_notices
    SET updated_at = COALESCE(updated_at, created_at),
        published_at = CASE
          WHEN status = 'sent' THEN COALESCE(published_at, created_at)
          ELSE published_at
        END;

    CREATE UNIQUE INDEX IF NOT EXISTS platform_notices_request_id_idx
      ON platform_notices (request_id)
      WHERE request_id IS NOT NULL AND request_id <> '';

    CREATE TABLE IF NOT EXISTS platform_notice_deliveries (
      id TEXT PRIMARY KEY,
      notice_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      tenant_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'delivered',
      created_at TEXT NOT NULL
    );
    ALTER TABLE platform_notice_deliveries ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'delivered';

    CREATE TABLE IF NOT EXISTS platform_notice_attachments (
      id TEXT PRIMARY KEY,
      notice_id TEXT,
      original_name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_size INTEGER NOT NULL DEFAULT 0,
      content_type TEXT NOT NULL,
      storage_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'uploaded',
      uploaded_by_name TEXT NOT NULL DEFAULT 'platform_admin',
      uploaded_by_role TEXT NOT NULL DEFAULT 'platform_super_admin',
      created_at TEXT NOT NULL,
      bound_at TEXT,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS platform_notice_user_states (
      notice_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      read_at TEXT,
      archived_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (notice_id, tenant_id, user_name)
    );

    CREATE INDEX IF NOT EXISTS platform_notices_created_at_idx
      ON platform_notices (created_at DESC);
    CREATE INDEX IF NOT EXISTS platform_notice_deliveries_tenant_created_idx
      ON platform_notice_deliveries (tenant_id, created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS platform_notice_deliveries_notice_tenant_idx
      ON platform_notice_deliveries (notice_id, tenant_id);
    CREATE INDEX IF NOT EXISTS platform_notice_attachments_notice_idx
      ON platform_notice_attachments (notice_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS platform_notice_attachments_status_created_idx
      ON platform_notice_attachments (status, created_at DESC);
    CREATE INDEX IF NOT EXISTS platform_notice_user_states_tenant_user_idx
      ON platform_notice_user_states (tenant_id, user_name, updated_at DESC);
  `);
}
async function migratePasswordHashes(client) {
    const result = await client.query("SELECT id, password, password_hash FROM login_accounts");
    for (const row of result.rows) {
        if (row.password_hash)
            continue;
        await client.query("UPDATE login_accounts SET password_hash = $1 WHERE id = $2", [
            (0, password_1.hashPassword)(row.password || "123456"),
            row.id,
        ]);
    }
}
