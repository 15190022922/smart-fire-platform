import { getServerSession } from "@/lib/server-auth";
import { proxyBackendJson } from "@/lib/backend-proxy";

export async function GET() {
  const session = await getServerSession();
  return proxyBackendJson("/api/tenant/device-points", { method: "GET", session });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  const body = await request.text();
  return proxyBackendJson("/api/tenant/device-points", { method: "POST", session, body });
}

export async function DELETE(request: Request) {
  const session = await getServerSession();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const path = id ? `/api/tenant/device-points?id=${encodeURIComponent(id)}` : "/api/tenant/device-points";
  return proxyBackendJson(path, { method: "DELETE", session });
}
