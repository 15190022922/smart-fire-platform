"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDemoSeed = runDemoSeed;
exports.bootstrapDatabase = bootstrapDatabase;
const client_1 = require("../client");
const runner_1 = require("../migrations/runner");
const seed_1 = require("./seed");
async function runDemoSeed() {
    await (0, client_1.withDbClient)(async (client) => {
        await client.query("BEGIN");
        try {
            await (0, seed_1.seedDemoCoreData)(client);
            await (0, seed_1.seedDemoSpatialData)(client);
            await (0, seed_1.seedOperationalDefaults)(client);
            await client.query("COMMIT");
        }
        catch (error) {
            await client.query("ROLLBACK");
            throw error;
        }
    });
}
async function bootstrapDatabase(options) {
    const includeDemoSeed = options?.includeDemoSeed ?? true;
    if (options?.force) {
        await (0, runner_1.runMigrations)();
        if (includeDemoSeed) {
            await runDemoSeed();
        }
        return;
    }
    if (!globalThis.__smartFireDatabaseBootstrapPromise) {
        globalThis.__smartFireDatabaseBootstrapPromise = (async () => {
            await (0, runner_1.runMigrations)();
            if (includeDemoSeed) {
                await runDemoSeed();
            }
        })().finally(() => {
            globalThis.__smartFireDatabaseBootstrapPromise = undefined;
        });
    }
    await globalThis.__smartFireDatabaseBootstrapPromise;
}
