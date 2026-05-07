import { getServerSession } from "@/lib/server-auth";
import { proxyBackendJson } from "@/lib/backend-proxy";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const { id } = await context.params;
  return proxyBackendJson(`/api/tenant/drawings/${encodeURIComponent(id)}/archive`, { method: "POST", session });
}
