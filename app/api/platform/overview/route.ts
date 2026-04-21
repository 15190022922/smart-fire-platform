import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-auth";
import { getPlatformOverview } from "@/lib/db";

export async function GET() {
  const session = await getServerSession();

  if (!session || session.scope !== "platform") {
    return NextResponse.json({ message: "无权限访问平台数据" }, { status: 403 });
  }

  return NextResponse.json(await getPlatformOverview());
}
