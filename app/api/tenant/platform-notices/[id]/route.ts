import { proxyBackendJson } from "@/lib/backend-proxy";
import { getServerSession } from "@/lib/server-auth";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const { id } = await context.params;
  return proxyBackendJson(`/api/tenant/platform-notices/${encodeURIComponent(id)}`, { method: "GET", session });
}
