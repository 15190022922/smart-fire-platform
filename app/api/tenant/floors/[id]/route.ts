import { getServerSession } from "@/lib/server-auth";
import { proxyBackendJson } from "@/lib/backend-proxy";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getServerSession();
  const { id } = await context.params;
  const body = await request.text();
  return proxyBackendJson(`/api/tenant/floors/${encodeURIComponent(id)}`, { method: "PATCH", session, body });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getServerSession();
  const { id } = await context.params;
  return proxyBackendJson(`/api/tenant/floors/${encodeURIComponent(id)}`, { method: "DELETE", session });
}
