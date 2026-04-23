import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-auth";
import { getTenantOverview, updateTenantAlarmProcessStatus } from "@/lib/db";

const allowedProcessStatuses = new Set(["未处理", "处理中", "已处理"]);

export async function GET() {
  const session = await getServerSession();

  if (!session?.tenantId || session.scope !== "tenant") {
    return NextResponse.json({ message: "无权访问报警数据" }, { status: 403 });
  }

  const overview = await getTenantOverview(session.tenantId);
  return NextResponse.json({ alarms: overview.alarms });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.tenantId || session.scope !== "tenant") {
    return NextResponse.json({ message: "无权更新报警状态" }, { status: 403 });
  }

  const body = (await request.json()) as {
    alarmId?: string;
    processStatus?: string;
  };

  if (!body.alarmId || !body.processStatus || !allowedProcessStatuses.has(body.processStatus)) {
    return NextResponse.json({ message: "报警编号或处理状态无效" }, { status: 400 });
  }

  try {
    const result = await updateTenantAlarmProcessStatus(
      session.tenantId,
      body.alarmId,
      body.processStatus as "未处理" | "处理中" | "已处理",
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "ALARM_NOT_FOUND") {
      return NextResponse.json({ message: "报警记录不存在" }, { status: 404 });
    }

    console.error("update tenant alarm process status failed", error);
    return NextResponse.json({ message: "更新报警状态失败" }, { status: 500 });
  }
}
