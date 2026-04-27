import { getServerSession } from "@/lib/server-auth";
import { proxyBackendJson } from "@/lib/backend-proxy";

export async function GET() {
  const session = await getServerSession();
  return proxyBackendJson("/api/admin/state", { method: "GET", session });
}

export async function PUT(request: Request) {
  const session = await getServerSession();
  const body = await request.text();
  return proxyBackendJson("/api/admin/state", { method: "PUT", session, body });
}
