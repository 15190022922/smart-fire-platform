import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-auth";
import { authRepository } from "../../../../packages/database/src/ops-repositories";

export async function POST(request: Request) {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ message: "未登录或会话已失效" }, { status: 401 });
  }

  const body = (await request.json()) as {
    currentPassword?: string;
    nextPassword?: string;
  };

  if (!body.currentPassword || !body.nextPassword) {
    return NextResponse.json({ message: "请输入当前密码和新密码" }, { status: 400 });
  }

  if (body.nextPassword.length < 6) {
    return NextResponse.json({ message: "新密码长度至少 6 位" }, { status: 400 });
  }

  const account = await authRepository.findLoginAccountByCredentials(session.username, body.currentPassword);
  if (!account) {
    return NextResponse.json({ message: "当前密码错误" }, { status: 400 });
  }

  await authRepository.updateLoginPasswordByUsername(session.username, body.nextPassword);
  return NextResponse.json({ success: true });
}
