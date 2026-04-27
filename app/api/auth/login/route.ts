import { NextResponse } from "next/server";
import { encodeSession } from "@/lib/auth";
import { AUTH_COOKIE_NAME } from "@/lib/auth-shared";
import { adminRepository, authRepository } from "../../../../packages/database/src/ops-repositories";
import { createAuditLogEntry } from "../../../../packages/database/src/repositories/audit-repository";
import { createDutyLogEntry } from "../../../../packages/database/src/repositories/duty-repository";

export async function POST(request: Request) {
  const body = (await request.json()) as { username?: string; password?: string };

  if (!body.username || !body.password) {
    return NextResponse.json({ message: "用户名和密码不能为空" }, { status: 400 });
  }

  const account = await authRepository.findLoginAccountByCredentials(body.username, body.password);
  if (!account) {
    return NextResponse.json({ message: "用户名或密码错误" }, { status: 401 });
  }

  const tenant = await adminRepository.getTenantById(account.tenantId);
  const session = {
    userId: account.id,
    username: account.username,
    displayName: account.displayName,
    scope: account.scope,
    roleKey: account.roleKey,
    tenantId: account.tenantId,
    tenantName: tenant?.name,
    defaultView: account.scope === "platform" ? "platform" : "tenant",
    mustChangePassword: account.mustChangePassword ?? false,
  } as const;

  await createAuditLogEntry({
    tenantId: account.tenantId,
    actorScope: account.scope,
    actorName: account.username,
    actorRole: String(account.roleKey),
    action: "auth.login",
    targetType: "session",
    targetId: account.id,
    result: "success",
    detail: "用户登录成功",
  });

  if (account.scope === "tenant" && account.tenantId) {
    await createDutyLogEntry({
      tenantId: account.tenantId,
      logType: "login",
      content: `用户 ${account.displayName} 登录系统`,
      operatorName: account.displayName,
    });
  }

  const response = NextResponse.json({
    message: "登录成功",
    session,
    redirectTo: account.mustChangePassword
      ? account.scope === "platform"
        ? "/admin/profile?forcePassword=1"
        : "/profile?forcePassword=1"
      : account.scope === "platform"
        ? "/admin"
        : "/",
  });

  response.cookies.set(AUTH_COOKIE_NAME, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return response;
}
