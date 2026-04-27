import { getServerSession } from "@/lib/server-auth";
import { proxyBackendJson } from "@/lib/backend-proxy";

export async function GET() {
  const session = await getServerSession();
  return proxyBackendJson("/api/tenant/drawings", { method: "GET", session });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  const body = await request.text();
  return proxyBackendJson("/api/tenant/drawings", { method: "POST", session, body });
}

export async function DELETE(request: Request) {
  const session = await getServerSession();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const path = id ? `/api/tenant/drawings?id=${encodeURIComponent(id)}` : "/api/tenant/drawings";
  return proxyBackendJson(path, { method: "DELETE", session });
}
