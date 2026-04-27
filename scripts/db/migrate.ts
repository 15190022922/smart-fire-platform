import { loadBackendEnv } from "../../apps/backend/src/lib/load-env";
import { migrateDatabase } from "../../apps/backend/src/lib/db-maintenance";

loadBackendEnv();

async function main() {
  const result = await migrateDatabase();
  console.log(JSON.stringify({ ok: true, command: "db:migrate", ...result }, null, 2));
}

void main().catch((error) => {
  console.error("[db:migrate]", error);
  process.exitCode = 1;
});
