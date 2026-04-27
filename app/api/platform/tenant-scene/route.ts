import { getServerSession } from "@/lib/server-auth";
import { proxyBackendJson } from "@/lib/backend-proxy";

export async function GET(request: Request) {
  const session = await getServerSession();
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId");
  const path = tenantId
    ? `/api/platform/tenant-scene?tenantId=${encodeURIComponent(tenantId)}`
    : "/api/platform/tenant-scene";
  return proxyBackendJson(path, { method: "GET", session });
}
