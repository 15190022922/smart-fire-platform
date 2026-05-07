"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.platformNoticeDraftsMigration = void 0;
exports.platformNoticeDraftsMigration = {
    id: "0010_platform_notice_drafts",
    description: "Add platform notice drafts and publish timestamps",
    up: async (client) => {
        await client.query(`
      ALTER TABLE platform_notices ADD COLUMN IF NOT EXISTS target_tenant_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE platform_notices ADD COLUMN IF NOT EXISTS updated_at TEXT;
      ALTER TABLE platform_notices ADD COLUMN IF NOT EXISTS published_at TEXT;

      UPDATE platform_notices
      SET updated_at = COALESCE(updated_at, created_at),
          published_at = CASE
            WHEN status = 'sent' THEN COALESCE(published_at, created_at)
            ELSE published_at
          END;
    `);
    },
};
