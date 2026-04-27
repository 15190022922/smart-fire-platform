import { loadBackendEnv } from "../../apps/backend/src/lib/load-env";
import { resetDatabase } from "../../apps/backend/src/lib/db-maintenance";

loadBackendEnv();

async function main() {
  await resetDatabase();
  console.log(JSON.stringify({ ok: true, command: "db:reset" }, null, 2));
}

void main().catch((error) => {
  console.error("[db:reset]", error);
  process.exitCode = 1;
});
