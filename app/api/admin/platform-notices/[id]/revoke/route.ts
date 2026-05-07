import { proxyBackendJson } from "@/lib/backend-proxy";
import { getServerSession } from "@/lib/server-auth";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const { id } = await context.params;
  const body = await request.text();
  return proxyBackendJson(`/api/admin/platform-notices/${encodeURIComponent(id)}/revoke`, {
    method: "POST",
    session,
    body,
  });
}
