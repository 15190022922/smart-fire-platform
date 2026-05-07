import { getServerSession } from "@/lib/server-auth";
import { proxyBackendJson } from "@/lib/backend-proxy";

export async function GET(request: Request) {
  const session = await getServerSession();
  const { searchParams } = new URL(request.url);
  const lifecycle = searchParams.get("lifecycle");
  const path = lifecycle ? `/api/tenant/devices?lifecycle=${encodeURIComponent(lifecycle)}` : "/api/tenant/devices";
  return proxyBackendJson(path, { method: "GET", session });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  const body = await request.text();
  return proxyBackendJson("/api/tenant/devices", {
    method: "POST",
    session,
    body,
  });
}

export async function DELETE(request: Request) {
  const session = await getServerSession();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const path = id ? `/api/tenant/devices?id=${encodeURIComponent(id)}` : "/api/tenant/devices";
  return proxyBackendJson(path, { method: "DELETE", session });
}
