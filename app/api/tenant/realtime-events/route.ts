import { getServerSession } from "@/lib/server-auth";
import { proxyBackendStream } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession();
  return proxyBackendStream("/api/tenant/realtime-events", { method: "GET", session });
}
