"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.drawingProcessingStateMigration = void 0;
exports.drawingProcessingStateMigration = {
    id: "0003_drawing_processing_state",
    description: "Add drawing conversion status and scene metadata",
    up: async (client) => {
        await client.query(`
      ALTER TABLE tenant_drawings ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'ready';
      ALTER TABLE tenant_drawings ADD COLUMN IF NOT EXISTS processing_message TEXT NOT NULL DEFAULT '';
      ALTER TABLE tenant_drawings ADD COLUMN IF NOT EXISTS conversion_log JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE tenant_drawings ADD COLUMN IF NOT EXISTS scene_url TEXT NOT NULL DEFAULT '';
      UPDATE tenant_drawings
      SET scene_url = CASE WHEN scene_url = '' THEN COALESCE(NULLIF(preview_url, ''), file_url) ELSE scene_url END,
          processing_status = CASE WHEN processing_status = '' THEN 'ready' ELSE processing_status END;
    `);
    },
};
