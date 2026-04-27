import { loadBackendEnv } from "../../apps/backend/src/lib/load-env";
import { seedDatabase } from "../../apps/backend/src/lib/db-maintenance";

loadBackendEnv();

async function main() {
  await seedDatabase();
  console.log(JSON.stringify({ ok: true, command: "db:seed" }, null, 2));
}

void main().catch((error) => {
  console.error("[db:seed]", error);
  process.exitCode = 1;
});
