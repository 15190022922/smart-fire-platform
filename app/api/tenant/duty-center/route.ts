import { NextRequest, NextResponse } from "next/server";
import { createDutySchedule, getDutyCenterData, handoverDutySchedule } from "@/lib/db";
import { getServerSession } from "@/lib/server-auth";

export async function GET() {
  const session = await getServerSession();
  if (!session?.tenantId || session.scope !== "tenant") {
    return NextResponse.json({ message: "无权访问值班中心" }, { status: 403 });
  }

  return NextResponse.json(await getDutyCenterData(session.tenantId));
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.tenantId || session.scope !== "tenant") {
    return NextResponse.json({ message: "无权创建值班排班" }, { status: 403 });
  }

  const body = (await request.json()) as {
    dutyDate?: string;
    shiftId?: string;
    assigneeName?: string;
    assigneePhone?: string;
  };

  if (!body.dutyDate || !body.shiftId || !body.assigneeName || !body.assigneePhone) {
    return NextResponse.json({ message: "排班参数不完整" }, { status: 400 });
  }

  await createDutySchedule(session.tenantId, {
    dutyDate: body.dutyDate,
    shiftId: body.shiftId,
    assigneeName: body.assigneeName,
    assigneePhone: body.assigneePhone,
    assignedBy: session.displayName || session.username,
  });

  return NextResponse.json(await getDutyCenterData(session.tenantId));
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.tenantId || session.scope !== "tenant") {
    return NextResponse.json({ message: "无权执行交接班" }, { status: 403 });
  }

  const body = (await request.json()) as {
    scheduleId?: string;
    nextScheduleId?: string;
    note?: string;
  };

  if (!body.scheduleId) {
    return NextResponse.json({ message: "缺少当前班次记录" }, { status: 400 });
  }

  try {
    await handoverDutySchedule(session.tenantId, {
      scheduleId: body.scheduleId,
      nextScheduleId: body.nextScheduleId,
      note: body.note ?? "",
      operatorName: session.displayName || session.username,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "HANDOVER_NOTE_REQUIRED") {
      return NextResponse.json({ message: "存在未闭环报警时必须填写交接说明" }, { status: 400 });
    }
    throw error;
  }

  return NextResponse.json(await getDutyCenterData(session.tenantId));
}
