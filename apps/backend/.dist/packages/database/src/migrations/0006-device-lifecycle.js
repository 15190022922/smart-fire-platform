"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deviceLifecycleMigration = void 0;
exports.deviceLifecycleMigration = {
    id: "0006_device_lifecycle",
    description: "Support safe device disable and restore lifecycle states",
    up: async (client) => {
        await client.query(`
      ALTER TABLE tenant_devices ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'active';
      ALTER TABLE tenant_devices ADD COLUMN IF NOT EXISTS disabled_at TEXT;
      ALTER TABLE tenant_devices ADD COLUMN IF NOT EXISTS disabled_reason TEXT NOT NULL DEFAULT '';
      UPDATE tenant_devices
      SET lifecycle_status = 'active'
      WHERE lifecycle_status IS NULL OR lifecycle_status = '';
      CREATE INDEX IF NOT EXISTS tenant_devices_tenant_lifecycle_idx
        ON tenant_devices (tenant_id, lifecycle_status);
    `);
    },
};
