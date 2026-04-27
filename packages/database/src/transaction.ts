import type { PoolClient } from "pg";
import { withDbClient } from "./client";

export async function withTransaction<T>(runner: (client: PoolClient) => Promise<T>) {
  return withDbClient(async (client) => {
    await client.query("BEGIN");
    try {
      const result = await runner(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}
