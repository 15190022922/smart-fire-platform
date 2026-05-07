"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deviceCustomAttributesMigration = void 0;
exports.deviceCustomAttributesMigration = {
    id: "0005_device_custom_attributes",
    description: "Support tenant-configured device attributes and import identity fields",
    up: async (client) => {
        await client.query(`
      ALTER TABLE tenant_devices ADD COLUMN IF NOT EXISTS device_code TEXT NOT NULL DEFAULT '';
      ALTER TABLE tenant_devices ADD COLUMN IF NOT EXISTS installation_status TEXT NOT NULL DEFAULT '';
      ALTER TABLE tenant_devices ADD COLUMN IF NOT EXISTS custom_attributes JSONB NOT NULL DEFAULT '{}'::jsonb;

      CREATE UNIQUE INDEX IF NOT EXISTS tenant_devices_tenant_device_code_idx
        ON tenant_devices (tenant_id, device_code)
        WHERE device_code <> '';

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
    `);
    },
};
