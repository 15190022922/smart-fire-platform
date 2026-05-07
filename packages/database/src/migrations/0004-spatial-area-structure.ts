import type { PoolClient } from "pg";

export const spatialAreaStructureMigration = {
  id: "0004_spatial_area_structure",
  description: "Promote buildings to editable spatial areas and support area-level drawings",
  up: async (client: PoolClient) => {
    await client.query(`
      ALTER TABLE tenant_buildings ADD COLUMN IF NOT EXISTS area_type TEXT NOT NULL DEFAULT 'building';
      ALTER TABLE tenant_buildings ADD COLUMN IF NOT EXISTS has_floors BOOLEAN NOT NULL DEFAULT TRUE;
      ALTER TABLE tenant_buildings ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE tenant_buildings ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
      ALTER TABLE tenant_buildings ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
      UPDATE tenant_buildings
      SET area_type = CASE WHEN area_type = '' THEN COALESCE(NULLIF(usage_type, ''), 'building') ELSE area_type END;

      ALTER TABLE tenant_floors ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE tenant_floors ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
      UPDATE tenant_floors SET sort_order = level_index WHERE sort_order = 0;

      ALTER TABLE tenant_drawings ADD COLUMN IF NOT EXISTS building_id TEXT NOT NULL DEFAULT '';
      UPDATE tenant_drawings d
      SET building_id = f.building_id
      FROM tenant_floors f
      WHERE d.tenant_id = f.tenant_id AND d.floor_id = f.id AND d.building_id = '';

      ALTER TABLE tenant_device_points ADD COLUMN IF NOT EXISTS building_id TEXT NOT NULL DEFAULT '';
      UPDATE tenant_device_points p
      SET building_id = COALESCE(NULLIF(d.building_id, ''), f.building_id, '')
      FROM tenant_drawings d
      LEFT JOIN tenant_floors f ON f.tenant_id = d.tenant_id AND f.id = d.floor_id
      WHERE p.tenant_id = d.tenant_id AND p.drawing_id = d.id AND p.building_id = '';
    `);
  },
};
