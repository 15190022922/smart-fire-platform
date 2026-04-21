import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-auth";
import { deleteTenantDevice, listTenantDevices, upsertTenantDevice } from "@/lib/db";

export async function GET() {
  const session = await getServerSession();

  if (!session?.tenantId || session.scope !== "tenant") {
    return NextResponse.json({ message: "无权访问设备数据" }, { status: 403 });
  }

  return NextResponse.json({ devices: await listTenantDevices(session.tenantId) });
}

export async function POST(request: Request) {
  const session = await getServerSession();

  if (!session?.tenantId || session.scope !== "tenant") {
    return NextResponse.json({ message: "无权修改设备数据" }, { status: 403 });
  }

  const body = await request.json();
  const device = await upsertTenantDevice(session.tenantId, body);
  return NextResponse.json({ device });
}

export async function DELETE(request: Request) {
  const session = await getServerSession();

  if (!session?.tenantId || session.scope !== "tenant") {
    return NextResponse.json({ message: "无权删除设备数据" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ message: "缺少设备 ID" }, { status: 400 });
  }

  await deleteTenantDevice(session.tenantId, id);
  return NextResponse.json({ success: true });
}
