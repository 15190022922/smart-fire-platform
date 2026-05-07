import { getServerSession } from "@/lib/server-auth";
import { proxyBackendJson } from "@/lib/backend-proxy";

export async function GET(request: Request) {
  const session = await getServerSession();
  const url = new URL(request.url);
  return proxyBackendJson(`/api/tenant/platform-notices${url.search}`, { method: "GET", session });
}
