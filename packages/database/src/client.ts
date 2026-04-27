import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

declare global {
  var __smartFireDatabasePool: Pool | undefined;
}

export type DbExecutor = Pick<PoolClient, "query">;

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }
  return databaseUrl;
}

function resolveSsl(databaseUrl: string): false | { rejectUnauthorized: false } {
  let ssl: false | { rejectUnauthorized: false } = { rejectUnauthorized: false };

  try {
    const parsed = new URL(databaseUrl);
    const host = parsed.hostname;
    const sslMode = parsed.searchParams.get("sslmode");
    const isLocalHost =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

    if (isLocalHost || sslMode === "disable") {
      ssl = false;
    }
  } catch {
    ssl = databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false };
  }

  return ssl;
}

function getPool() {
  if (!globalThis.__smartFireDatabasePool) {
    const databaseUrl = getDatabaseUrl();
    globalThis.__smartFireDatabasePool = new Pool({
      connectionString: databaseUrl,
      ssl: resolveSsl(databaseUrl),
      max: 10,
    });
  }

  return globalThis.__smartFireDatabasePool;
}

export async function ensureDbReady() {
  await getPool().query("SELECT 1");
}

export async function withDbClient<T>(runner: (client: PoolClient) => Promise<T>) {
  await ensureDbReady();
  const client = await getPool().connect();
  try {
    return await runner(client);
  } finally {
    client.release();
  }
}

export async function queryDb<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []) {
  return withDbClient<QueryResult<T>>((client) => client.query<T>(sql, params));
}
