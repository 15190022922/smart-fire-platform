import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-auth";
import { getTenantOverview } from "@/lib/db";

export async function GET() {
  const session = await getServerSession();

  if (!session || session.scope !== "tenant" || !session.tenantId) {
    return NextResponse.json({ message: "无权限访问企业数据" }, { status: 403 });
  }

  return NextResponse.json(await getTenantOverview(session.tenantId));
}
