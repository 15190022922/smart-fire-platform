import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth-shared";
import { getServerSession } from "@/lib/server-auth";
import { createAuditLogEntry } from "../../../../packages/database/src/repositories/audit-repository";
import { createDutyLogEntry } from "../../../../packages/database/src/repositories/duty-repository";

export async function POST() {
  const session = await getServerSession();

  if (session) {
    await createAuditLogEntry({
      tenantId: session.tenantId,
      actorScope: session.scope,
      actorName: session.username,
      actorRole: String(session.roleKey),
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
