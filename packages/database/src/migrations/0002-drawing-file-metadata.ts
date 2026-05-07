import type { PoolClient } from "pg";

export const drawingFileMetadataMigration = {
  id: "0002_drawing_file_metadata",
  description: "Add drawing file metadata and publication timestamp",
  up: async (client: PoolClient) => {
    await client.query(`
      ALTER TABLE tenant_drawings ADD COLUMN IF NOT EXISTS file_type TEXT NOT NULL DEFAULT 'image';
      ALTER TABLE tenant_drawings ADD COLUMN IF NOT EXISTS source_file_url TEXT NOT NULL DEFAULT '';
      ALTER TABLE tenant_drawings ADD COLUMN IF NOT EXISTS preview_url TEXT NOT NULL DEFAULT '';
      ALTER TABLE tenant_drawings ADD COLUMN IF NOT EXISTS original_file_name TEXT NOT NULL DEFAULT '';
      ALTER TABLE tenant_drawings ADD COLUMN IF NOT EXISTS file_size INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE tenant_drawings ADD COLUMN IF NOT EXISTS published_at TEXT;
      UPDATE tenant_drawings
      SET source_file_url = CASE WHEN source_file_url = '' THEN file_url ELSE source_file_url END,
          preview_url = CASE WHEN preview_url = '' THEN file_url ELSE preview_url END,
          published_at = CASE WHEN status = 'published' AND published_at IS NULL THEN updated_at ELSE published_at END;
    `);
  },
};
