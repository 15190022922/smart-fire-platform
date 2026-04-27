import type { PoolClient } from "pg";
import { hashPassword } from "../../../../lib/password";

export async function applyBaseSchema(client: PoolClient) {
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
  `);
}

export async function migratePasswordHashes(client: PoolClient) {
  const result = await client.query<{ id: string; password: string; password_hash: string | null }>(
    "SELECT id, password, password_hash FROM login_accounts",
  );

  for (const row of result.rows) {
    if (row.password_hash) continue;
    await client.query("UPDATE login_accounts SET password_hash = $1 WHERE id = $2", [
      hashPassword(row.password || "123456"),
      row.id,
    ]);
  }
}
