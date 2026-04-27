import { getServerSession } from "@/lib/server-auth";
import { proxyBackendJson } from "@/lib/backend-proxy";

export async function GET() {
  const session = await getServerSession();
  return proxyBackendJson("/api/tenant/alarm-center", { method: "GET", session });
}

export async function PATCH(request: Request) {
  const session = await getServerSession();
  const body = await request.text();
  return proxyBackendJson("/api/tenant/alarm-center", {
    method: "PATCH",
    session,
    body,
  });
}
