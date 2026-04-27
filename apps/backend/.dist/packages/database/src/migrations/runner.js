"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureMigrationTable = ensureMigrationTable;
exports.runMigrations = runMigrations;
const client_1 = require("../client");
const index_1 = require("./index");
async function ensureMigrationTable() {
    await (0, client_1.withDbClient)(async (client) => {
        await client.query(`
      CREATE TABLE IF NOT EXISTS smart_fire_migrations (
        id TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    });
}
async function runMigrations() {
    await ensureMigrationTable();
    return (0, client_1.withDbClient)(async (client) => {
        const applied = await client.query("SELECT id FROM smart_fire_migrations");
        const appliedIds = new Set(applied.rows.map((row) => row.id));
        const pending = index_1.databaseMigrations.filter((migration) => !appliedIds.has(migration.id));
        for (const migration of pending) {
            await client.query("BEGIN");
            try {
                await migration.up(client);
                await client.query("INSERT INTO smart_fire_migrations (id, description) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING", [migration.id, migration.description]);
                await client.query("COMMIT");
            }
            catch (error) {
                await client.query("ROLLBACK");
                throw error;
            }
        }
        return {
            applied: index_1.databaseMigrations.length,
            pending: pending.length,
            migrations: index_1.databaseMigrations.map((migration) => ({
                id: migration.id,
                description: migration.description,
                applied: appliedIds.has(migration.id) || pending.some((item) => item.id === migration.id),
            })),
        };
    });
}
