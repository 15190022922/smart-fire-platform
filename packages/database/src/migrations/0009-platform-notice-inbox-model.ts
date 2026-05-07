import type { PoolClient } from "pg";

export const platformNoticeInboxModelMigration = {
  id: "0009_platform_notice_inbox_model",
  description: "Add platform notice inbox status, attachment records and user states",
  up: async (client: PoolClient) => {
    await client.query(`
      ALTER TABLE platform_notices ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'sent';
      ALTER TABLE platform_notices ADD COLUMN IF NOT EXISTS revoked_at TEXT;
      ALTER TABLE platform_notices ADD COLUMN IF NOT EXISTS deleted_at TEXT;
      ALTER TABLE platform_notices ADD COLUMN IF NOT EXISTS revoke_reason TEXT;
      ALTER TABLE platform_notices ADD COLUMN IF NOT EXISTS request_id TEXT;

      CREATE UNIQUE INDEX IF NOT EXISTS platform_notices_request_id_idx
        ON platform_notices (request_id)
        WHERE request_id IS NOT NULL AND request_id <> '';

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

      CREATE INDEX IF NOT EXISTS platform_notice_attachments_notice_idx
        ON platform_notice_attachments (notice_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS platform_notice_attachments_status_created_idx
        ON platform_notice_attachments (status, created_at DESC);

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

      CREATE INDEX IF NOT EXISTS platform_notice_user_states_tenant_user_idx
        ON platform_notice_user_states (tenant_id, user_name, updated_at DESC);

      ALTER TABLE platform_notice_deliveries ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'delivered';
    `);
  },
};
