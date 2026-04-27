"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDbReady = ensureDbReady;
exports.withDbClient = withDbClient;
exports.queryDb = queryDb;
const pg_1 = require("pg");
function getDatabaseUrl() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error("DATABASE_URL is not configured");
    }
    return databaseUrl;
}
function resolveSsl(databaseUrl) {
    let ssl = { rejectUnauthorized: false };
    try {
        const parsed = new URL(databaseUrl);
        const host = parsed.hostname;
        const sslMode = parsed.searchParams.get("sslmode");
        const isLocalHost = host === "localhost" ||
            host === "127.0.0.1" ||
            host === "::1" ||
            host.startsWith("192.168.") ||
            host.startsWith("10.") ||
            /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
        if (isLocalHost || sslMode === "disable") {
            ssl = false;
        }
    }
    catch {
        ssl = databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false };
    }
    return ssl;
}
function getPool() {
    if (!globalThis.__smartFireDatabasePool) {
        const databaseUrl = getDatabaseUrl();
        globalThis.__smartFireDatabasePool = new pg_1.Pool({
            connectionString: databaseUrl,
            ssl: resolveSsl(databaseUrl),
            max: 10,
        });
    }
    return globalThis.__smartFireDatabasePool;
}
async function ensureDbReady() {
    await getPool().query("SELECT 1");
}
async function withDbClient(runner) {
    await ensureDbReady();
    const client = await getPool().connect();
    try {
        return await runner(client);
    }
    finally {
        client.release();
    }
}
async function queryDb(sql, params = []) {
    return withDbClient((client) => client.query(sql, params));
}
