import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-auth";
import { getTenantOverview } from "@/lib/db";

export async function GET() {
  const session = await getServerSession();

  if (!session?.tenantId || session.scope !== "tenant") {
    return NextResponse.json({ message: "无权访问报警数据" }, { status: 403 });
  }

  const overview = await getTenantOverview(session.tenantId);
  return NextResponse.json({ alarms: overview.alarms });
}
