import { proxyBackendJson } from "@/lib/backend-proxy";
import { getServerSession } from "@/lib/server-auth";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const { id } = await context.params;
  const body = await request.text();
  return proxyBackendJson(`/api/tenant/platform-notices/${encodeURIComponent(id)}/state`, {
    method: "PATCH",
    session,
    body,
  });
}
