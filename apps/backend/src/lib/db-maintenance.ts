import { runDemoSeed } from "../../../../packages/database/src/bootstrap";
import { withDbClient } from "../../../../packages/database/src/client";
import { runMigrations } from "../../../../packages/database/src/migrations/runner";

export async function migrateDatabase() {
  return runMigrations();
}

export async function seedDatabase() {
  await runMigrations();
  await runDemoSeed();
}

export async function resetDatabase() {
  await withDbClient(async (client) => {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE");
    await client.query("CREATE SCHEMA public");
    await client.query("GRANT ALL ON SCHEMA public TO public");
  });

  await runMigrations();
  await runDemoSeed();
}
