import type { IncomingMessage, ServerResponse } from "http";
import { readJsonBody, sendJson } from "../../lib/http";
import type { BackendRequestContext } from "../auth/auth-context";
import { requireTenantContext } from "../auth/auth-controller";
import { tenantInspectionRepository } from "../../../../../packages/database/src/tenant-repositories";

export async function getInspectionCenter(res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const payload = await tenantInspectionRepository.getCenterData(context.tenantId!);
  sendJson(res, 200, payload);
}

export async function postInspection(
  req: IncomingMessage,
  res: ServerResponse,
  context: BackendRequestContext,
) {
  if (!requireTenantContext(res, context)) return;

  const body = (await readJsonBody(req)) as {
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
      sendJson(res, 400, { message: "巡检执行参数不完整" });
      return;
    }

    await tenantInspectionRepository.submitRecord(context.tenantId!, {
      taskId: body.taskId,
      result: body.result,
      note: body.note ?? "",
      inspectedBy: context.userName ?? "backend_api",
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
      sendJson(res, 400, { message: "巡检计划参数不完整" });
      return;
    }

    await tenantInspectionRepository.createTask(context.tenantId!, {
      title: body.title,
      planType: body.planType,
      targetType: body.targetType,
      targetId: body.targetId,
      targetName: body.targetName,
      dueDate: body.dueDate,
      assignedTo: body.assignedTo,
      note: body.note ?? "",
      operatorName: context.userName ?? "backend_api",
    });
  }

  const payload = await tenantInspectionRepository.getCenterData(context.tenantId!);
  sendJson(res, 200, payload);
}

export async function patchInspection(
  req: IncomingMessage,
  res: ServerResponse,
  context: BackendRequestContext,
) {
  if (!requireTenantContext(res, context)) return;

  const body = (await readJsonBody(req)) as {
    issueId?: string;
    status?: "未整改" | "整改中" | "已整改" | "已复查";
    note?: string;
  };

  if (!body.issueId || !body.status) {
    sendJson(res, 400, { message: "隐患状态参数不完整" });
    return;
  }

  await tenantInspectionRepository.updateIssue(context.tenantId!, {
    issueId: body.issueId,
    status: body.status,
    note: body.note ?? "",
    operatorName: context.userName ?? "backend_api",
  });

  const payload = await tenantInspectionRepository.getCenterData(context.tenantId!);
  sendJson(res, 200, payload);
}
