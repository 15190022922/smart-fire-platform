"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateDatabase = migrateDatabase;
exports.seedDatabase = seedDatabase;
exports.resetDatabase = resetDatabase;
const bootstrap_1 = require("../../../../packages/database/src/bootstrap");
const client_1 = require("../../../../packages/database/src/client");
const runner_1 = require("../../../../packages/database/src/migrations/runner");
async function migrateDatabase() {
    return (0, runner_1.runMigrations)();
}
async function seedDatabase() {
    await (0, runner_1.runMigrations)();
    await (0, bootstrap_1.runDemoSeed)();
}
async function resetDatabase() {
    await (0, client_1.withDbClient)(async (client) => {
        await client.query("DROP SCHEMA IF EXISTS public CASCADE");
        await client.query("CREATE SCHEMA public");
        await client.query("GRANT ALL ON SCHEMA public TO public");
    });
    await (0, runner_1.runMigrations)();
    await (0, bootstrap_1.runDemoSeed)();
}
