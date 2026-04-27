import { NextRequest } from "next/server";
import { proxyBackendJson } from "@/lib/backend-proxy";
import { getServerSession } from "@/lib/server-auth";

export async function GET() {
  const session = await getServerSession();
  return proxyBackendJson("/api/tenant/inspection", { method: "GET", session });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  const body = await request.text();
  return proxyBackendJson("/api/tenant/inspection", { method: "POST", session, body });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession();
  const body = await request.text();
  return proxyBackendJson("/api/tenant/inspection", { method: "PATCH", session, body });
}
