"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.platformNoticesMigration = void 0;
exports.platformNoticesMigration = {
    id: "0007_platform_notices",
    description: "Add platform notices delivered to tenant workspaces",
    up: async (client) => {
        await client.query(`
      CREATE TABLE IF NOT EXISTS platform_notices (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        level TEXT NOT NULL,
        target_mode TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        sender_role TEXT NOT NULL,
        target_tenant_count INTEGER NOT NULL DEFAULT 0,
        attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TEXT NOT NULL
      );
      ALTER TABLE platform_notices ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

      CREATE TABLE IF NOT EXISTS platform_notice_deliveries (
        id TEXT PRIMARY KEY,
        notice_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        tenant_name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS platform_notices_created_at_idx
        ON platform_notices (created_at DESC);
      CREATE INDEX IF NOT EXISTS platform_notice_deliveries_tenant_created_idx
        ON platform_notice_deliveries (tenant_id, created_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS platform_notice_deliveries_notice_tenant_idx
        ON platform_notice_deliveries (notice_id, tenant_id);
    `);
    },
};
