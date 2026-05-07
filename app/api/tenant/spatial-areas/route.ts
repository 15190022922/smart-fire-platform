import { getServerSession } from "@/lib/server-auth";
import { proxyBackendJson } from "@/lib/backend-proxy";

export async function POST(request: Request) {
  const session = await getServerSession();
  const body = await request.text();
  return proxyBackendJson("/api/tenant/spatial-areas", { method: "POST", session, body });
}
