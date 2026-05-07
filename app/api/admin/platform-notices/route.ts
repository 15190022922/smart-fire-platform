import { getServerSession } from "@/lib/server-auth";
import { proxyBackendJson } from "@/lib/backend-proxy";

export async function GET() {
  const session = await getServerSession();
  return proxyBackendJson("/api/admin/platform-notices", { method: "GET", session });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  const body = await request.text();
  return proxyBackendJson("/api/admin/platform-notices", { method: "POST", session, body });
}
