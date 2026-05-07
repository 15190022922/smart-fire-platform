import { getServerSession } from "@/lib/server-auth";
import { proxyBackendJson } from "@/lib/backend-proxy";

export async function GET() {
  const session = await getServerSession();
  return proxyBackendJson("/api/tenant/device-attributes", { method: "GET", session });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  const body = await request.text();
  return proxyBackendJson("/api/tenant/device-attributes", { method: "POST", session, body });
}

export async function DELETE(request: Request) {
  const session = await getServerSession();
  const { searchParams } = new URL(request.url);
  const fieldKey = searchParams.get("fieldKey");
  const path = fieldKey
    ? `/api/tenant/device-attributes?fieldKey=${encodeURIComponent(fieldKey)}`
    : "/api/tenant/device-attributes";
  return proxyBackendJson(path, { method: "DELETE", session });
}
