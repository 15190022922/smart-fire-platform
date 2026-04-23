import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-auth";
import { createTenantDrawing, deleteTenantDrawing } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getServerSession();

  if (!session?.tenantId || session.scope !== "tenant") {
    return NextResponse.json({ message: "无权修改图纸数据" }, { status: 403 });
  }

  const body = await request.json();
  const drawing = await createTenantDrawing(session.tenantId, body);
  return NextResponse.json({ drawing });
}

export async function DELETE(request: Request) {
  const session = await getServerSession();

  if (!session?.tenantId || session.scope !== "tenant") {
    return NextResponse.json({ message: "无权删除图纸数据" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ message: "缺少图纸 ID" }, { status: 400 });
  }

  await deleteTenantDrawing(session.tenantId, id);
  return NextResponse.json({ success: true });
}
