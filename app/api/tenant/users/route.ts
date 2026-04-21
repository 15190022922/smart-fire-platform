import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-auth";
import { deleteTenantUser, listTenantUsers, upsertTenantUser } from "@/lib/db";

export async function GET() {
  const session = await getServerSession();

  if (!session?.tenantId || session.scope !== "tenant") {
    return NextResponse.json({ message: "无权访问用户数据" }, { status: 403 });
  }

  return NextResponse.json({ users: await listTenantUsers(session.tenantId) });
}

export async function POST(request: Request) {
  const session = await getServerSession();

  if (!session?.tenantId || session.scope !== "tenant") {
    return NextResponse.json({ message: "无权修改用户数据" }, { status: 403 });
  }

  const body = await request.json();
  const user = await upsertTenantUser(session.tenantId, body);
  return NextResponse.json({ user });
}

export async function DELETE(request: Request) {
  const session = await getServerSession();

  if (!session?.tenantId || session.scope !== "tenant") {
    return NextResponse.json({ message: "无权删除用户数据" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ message: "缺少用户 ID" }, { status: 400 });
  }

  await deleteTenantUser(session.tenantId, id);
  return NextResponse.json({ success: true });
}
