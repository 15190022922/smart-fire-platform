import type { PoolClient } from "pg";
import { applyBaseSchema, migratePasswordHashes } from "../bootstrap/schema";

export const initialSchemaMigration = {
  id: "0001_initial_schema",
  description: "Create base schema and normalize legacy password hashes",
  up: async (client: PoolClient) => {
    await applyBaseSchema(client);
    await migratePasswordHashes(client);
  },
};
