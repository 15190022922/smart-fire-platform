import { NextResponse } from "next/server";
import { createTenantWithAdmin, deleteTenantCascade, updateTenant } from "@/lib/db";
import { getServerSession } from "@/lib/server-auth";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session || session.scope !== "platform") {
    return NextResponse.json({ message: "无权创建企业" }, { status: 403 });
  }

  const body = await request.json();
  try {
    const result = await createTenantWithAdmin(body);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error && /duplicate key|already exists|unique/i.test(error.message)
        ? "企业编码或管理员登录账号已存在"
        : "创建企业失败";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession();
  if (!session || session.scope !== "platform") {
    return NextResponse.json({ message: "无权修改企业" }, { status: 403 });
  }

  const body = await request.json();
  try {
    const tenant = await updateTenant(body);
    return NextResponse.json({ tenant });
  } catch {
    return NextResponse.json({ message: "修改企业失败" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession();
  if (!session || session.scope !== "platform") {
    return NextResponse.json({ message: "无权删除企业" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId");
  if (!tenantId) {
    return NextResponse.json({ message: "缺少企业 ID" }, { status: 400 });
  }

  await deleteTenantCascade(tenantId);
  return NextResponse.json({ success: true });
}
