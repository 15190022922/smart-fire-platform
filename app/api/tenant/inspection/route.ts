import { NextRequest, NextResponse } from "next/server";
import {
  createInspectionTask,
  getInspectionCenterData,
  submitInspectionRecord,
  updateIssueStatus,
} from "@/lib/db";
import { getServerSession } from "@/lib/server-auth";

export async function GET() {
  const session = await getServerSession();
  if (!session?.tenantId || session.scope !== "tenant") {
    return NextResponse.json({ message: "无权访问巡检维保模块" }, { status: 403 });
  }

  return NextResponse.json(await getInspectionCenterData(session.tenantId));
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.tenantId || session.scope !== "tenant") {
    return NextResponse.json({ message: "无权创建巡检任务" }, { status: 403 });
  }

  const body = (await request.json()) as {
    action?: "create-task" | "submit-record";
    title?: string;
    planType?: "daily" | "weekly";
    targetType?: "device" | "area";
    targetId?: string;
    targetName?: string;
    dueDate?: string;
    assignedTo?: string;
    taskId?: string;
    result?: "completed" | "abnormal";
    note?: string;
  };

  if ((body.action ?? "create-task") === "submit-record") {
    if (!body.taskId || !body.result) {
      return NextResponse.json({ message: "巡检执行参数不完整" }, { status: 400 });
    }

    await submitInspectionRecord(session.tenantId, {
      taskId: body.taskId,
      result: body.result,
      note: body.note ?? "",
      inspectedBy: session.displayName || session.username,
    });
  } else {
    if (
      !body.title ||
      !body.planType ||
      !body.targetType ||
      !body.targetId ||
      !body.targetName ||
      !body.dueDate ||
      !body.assignedTo
    ) {
      return NextResponse.json({ message: "巡检计划参数不完整" }, { status: 400 });
    }

    await createInspectionTask(session.tenantId, {
      title: body.title,
      planType: body.planType,
      targetType: body.targetType,
      targetId: body.targetId,
      targetName: body.targetName,
      dueDate: body.dueDate,
      assignedTo: body.assignedTo,
      note: body.note ?? "",
      operatorName: session.displayName || session.username,
    });
  }

  return NextResponse.json(await getInspectionCenterData(session.tenantId));
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.tenantId || session.scope !== "tenant") {
    return NextResponse.json({ message: "无权修改隐患状态" }, { status: 403 });
  }

  const body = (await request.json()) as {
    issueId?: string;
    status?: "未整改" | "整改中" | "已整改" | "已复查";
    note?: string;
  };

  if (!body.issueId || !body.status) {
    return NextResponse.json({ message: "隐患状态参数不完整" }, { status: 400 });
  }

  await updateIssueStatus(session.tenantId, {
    issueId: body.issueId,
    status: body.status,
    note: body.note ?? "",
    operatorName: session.displayName || session.username,
  });

  return NextResponse.json(await getInspectionCenterData(session.tenantId));
}
