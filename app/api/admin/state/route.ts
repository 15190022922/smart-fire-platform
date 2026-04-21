import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-auth";
import { getAdminState, replaceAdminState } from "@/lib/db";

export async function GET() {
  const session = await getServerSession();

  if (!session || session.scope !== "platform") {
    return NextResponse.json({ message: "无权访问平台数据" }, { status: 403 });
  }

  return NextResponse.json(await getAdminState());
}

export async function PUT(request: Request) {
  const session = await getServerSession();

  if (!session || session.scope !== "platform") {
    return NextResponse.json({ message: "无权修改平台数据" }, { status: 403 });
  }

  const body = await request.json();
  await replaceAdminState(body);
  return NextResponse.json({ success: true });
}
