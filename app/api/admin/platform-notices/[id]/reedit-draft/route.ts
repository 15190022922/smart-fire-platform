import { proxyBackendJson } from "@/lib/backend-proxy";
import { getServerSession } from "@/lib/server-auth";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const { id } = await context.params;
  return proxyBackendJson(`/api/admin/platform-notices/${encodeURIComponent(id)}/reedit-draft`, {
    method: "POST",
    session,
  });
}
