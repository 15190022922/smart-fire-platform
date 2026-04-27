import { withDbClient } from "../client";
import { runMigrations } from "../migrations/runner";
import { seedDemoCoreData, seedDemoSpatialData, seedOperationalDefaults } from "./seed";

declare global {
  var __smartFireDatabaseBootstrapPromise: Promise<void> | undefined;
}

export async function runDemoSeed() {
  await withDbClient(async (client) => {
    await client.query("BEGIN");
    try {
      await seedDemoCoreData(client);
      await seedDemoSpatialData(client);
      await seedOperationalDefaults(client);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

export async function bootstrapDatabase(options?: { includeDemoSeed?: boolean; force?: boolean }) {
  const includeDemoSeed = options?.includeDemoSeed ?? true;

  if (options?.force) {
    await runMigrations();
    if (includeDemoSeed) {
      await runDemoSeed();
    }
    return;
  }

  if (!globalThis.__smartFireDatabaseBootstrapPromise) {
    globalThis.__smartFireDatabaseBootstrapPromise = (async () => {
      await runMigrations();
      if (includeDemoSeed) {
        await runDemoSeed();
      }
    })().finally(() => {
      globalThis.__smartFireDatabaseBootstrapPromise = undefined;
    });
  }

  await globalThis.__smartFireDatabaseBootstrapPromise;
}
