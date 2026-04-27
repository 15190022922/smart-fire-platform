import { getServerSession } from "@/lib/server-auth";
import { proxyBackendJson } from "@/lib/backend-proxy";

export async function POST(request: Request) {
  const session = await getServerSession();
  const body = await request.text();
  return proxyBackendJson("/api/admin/tenants", { method: "POST", session, body });
}

export async function PUT(request: Request) {
  const session = await getServerSession();
  const body = await request.text();
  return proxyBackendJson("/api/admin/tenants", { method: "PUT", session, body });
}

export async function DELETE(request: Request) {
  const session = await getServerSession();
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId");
  const path = tenantId ? `/api/admin/tenants?tenantId=${encodeURIComponent(tenantId)}` : "/api/admin/tenants";
  return proxyBackendJson(path, { method: "DELETE", session });
}
