import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth-shared";
import { createAuditLog, createDutyLogEntry } from "@/lib/db";
import { getServerSession } from "@/lib/server-auth";

export async function POST() {
  const session = await getServerSession();

  if (session) {
    await createAuditLog({
      tenantId: session.tenantId,
      actorScope: session.scope,
      actorName: session.username,
      actorRole: session.roleKey,
      action: "auth.logout",
      targetType: "session",
      targetId: session.userId,
      result: "success",
      detail: "用户退出登录",
    });

    if (session.scope === "tenant" && session.tenantId) {
      await createDutyLogEntry({
        tenantId: session.tenantId,
        logType: "shift_action",
        content: `用户 ${session.displayName || session.username} 退出系统`,
        operatorName: session.displayName || session.username,
      });
    }
  }

  const response = NextResponse.json({ message: "已退出登录" });
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
