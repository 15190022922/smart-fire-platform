import { getServerSession } from "@/lib/server-auth";
import { proxyBackendJson } from "@/lib/backend-proxy";

export async function GET() {
  const session = await getServerSession();
  return proxyBackendJson("/api/tenant/audit-log", { method: "GET", session });
}
