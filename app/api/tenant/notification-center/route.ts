import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-auth";
import { proxyBackendJson } from "@/lib/backend-proxy";
import { retryNotificationRecord } from "@/lib/db";

export async function GET() {
  const session = await getServerSession();
  return proxyBackendJson("/api/tenant/notification-center", { method: "GET", session });
}

export async function PATCH(request: Request) {
  const session = await getServerSession();

  if (!session?.tenantId || session.scope !== "tenant") {
    return NextResponse.json({ message: "无权重试通知" }, { status: 403 });
  }

  const body = (await request.json()) as { recordId?: string };
  if (!body.recordId) {
    return NextResponse.json({ message: "缺少通知记录编号" }, { status: 400 });
  }

  await retryNotificationRecord(session.tenantId, body.recordId);
  return NextResponse.json({ success: true, mode: "compat-next-route" });
}
