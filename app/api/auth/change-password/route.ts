import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-auth";
import { findLoginAccount, updateLoginPassword } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getServerSession();

  if (!session || session.scope !== "platform") {
    return NextResponse.json({ message: "无权修改管理员密码" }, { status: 403 });
  }

  const body = (await request.json()) as {
    currentPassword?: string;
    nextPassword?: string;
  };

  if (!body.currentPassword || !body.nextPassword) {
    return NextResponse.json({ message: "请输入当前密码和新密码" }, { status: 400 });
  }

  const account = await findLoginAccount(session.username, body.currentPassword);
  if (!account) {
    return NextResponse.json({ message: "当前密码错误" }, { status: 400 });
  }

  await updateLoginPassword(session.username, body.nextPassword);
  return NextResponse.json({ success: true });
}
