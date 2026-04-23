import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-auth";
import { deleteTenantDevicePoint, upsertTenantDevicePoint } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getServerSession();

  if (!session?.tenantId || session.scope !== "tenant") {
    return NextResponse.json({ message: "无权修改设备点位" }, { status: 403 });
  }

  const body = await request.json();
  const point = await upsertTenantDevicePoint(session.tenantId, body);
  return NextResponse.json({ point });
}

export async function DELETE(request: Request) {
  const session = await getServerSession();

  if (!session?.tenantId || session.scope !== "tenant") {
    return NextResponse.json({ message: "无权删除设备点位" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ message: "缺少点位 ID" }, { status: 400 });
  }

  await deleteTenantDevicePoint(session.tenantId, id);
  return NextResponse.json({ success: true });
}
