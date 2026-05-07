import { getServerSession } from "@/lib/server-auth";
import { proxyBackendJson } from "@/lib/backend-proxy";

export async function PATCH(request: Request) {
  const session = await getServerSession();
  const body = await request.text();
  return proxyBackendJson("/api/tenant/devices/lifecycle", {
    method: "PATCH",
    session,
    body,
  });
}
