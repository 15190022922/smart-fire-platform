import { NextResponse } from "next/server";
import { encodeSession } from "@/lib/auth";
import { AUTH_COOKIE_NAME } from "@/lib/auth-shared";
import { findLoginAccount, getTenantById } from "@/lib/db";

export async function POST(request: Request) {
  const body = (await request.json()) as { username?: string; password?: string };

  if (!body.username || !body.password) {
    return NextResponse.json({ message: "用户名和密码不能为空" }, { status: 400 });
  }

  const account = await findLoginAccount(body.username, body.password);
  if (!account) {
    return NextResponse.json({ message: "用户名或密码错误" }, { status: 401 });
  }

  const tenant = await getTenantById(account.tenantId);
  const session = {
    userId: account.id,
    username: account.username,
    displayName: account.displayName,
    scope: account.scope,
    roleKey: account.roleKey,
    tenantId: account.tenantId,
    tenantName: tenant?.name,
    defaultView: account.scope === "platform" ? "platform" : "tenant",
  } as const;

  const response = NextResponse.json({
    message: "登录成功",
    session,
    redirectTo: account.scope === "platform" ? "/admin" : "/",
  });

  response.cookies.set(AUTH_COOKIE_NAME, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return response;
}
