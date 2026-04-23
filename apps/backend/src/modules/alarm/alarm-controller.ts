import type { IncomingMessage, ServerResponse } from "http";
import { readJsonBody, sendJson } from "../../lib/http";
import type { BackendRequestContext } from "../auth/auth-context";
import { requireTenantContext } from "../auth/auth-controller";
import { tenantAlarmRepository } from "../../../../../packages/database/src/tenant-repositories";
import type { AlarmWorkflowStatus } from "../../../../../types/ops";

const allowedWorkflowStatuses = new Set<AlarmWorkflowStatus>(["未处理", "已确认", "处理中", "已完成", "已关闭"]);

export async function getAlarmCenter(res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const alarms = await tenantAlarmRepository.list(context.tenantId!);
  sendJson(res, 200, { alarms });
}

export async function patchAlarmCenter(
  req: IncomingMessage,
  res: ServerResponse,
  context: BackendRequestContext,
) {
  if (!requireTenantContext(res, context)) return;

  const body = (await readJsonBody(req)) as {
    alarmId?: string;
    nextStatus?: AlarmWorkflowStatus;
    falseAlarm?: boolean;
    note?: string;
    attachments?: string[];
    assignedUserName?: string;
  };

  if (!body.alarmId || !body.nextStatus || !allowedWorkflowStatuses.has(body.nextStatus)) {
    sendJson(res, 400, { message: "报警编号或目标状态无效" });
    return;
  }

  try {
    const result = await tenantAlarmRepository.updateWorkflow(context.tenantId!, {
      alarmId: body.alarmId,
      nextStatus: body.nextStatus,
      falseAlarm: body.falseAlarm,
      note: body.note,
      attachments: body.attachments,
      assignedUserName: body.assignedUserName,
      operatorName: context.userName ?? "backend_api",
      operatorRole: context.userRole ?? "backend_api",
    });
    sendJson(res, 200, result);
  } catch (error) {
    if (error instanceof Error && error.message === "ALARM_NOT_FOUND") {
      sendJson(res, 404, { message: "报警记录不存在" });
      return;
    }
    sendJson(res, 500, { message: "报警闭环更新失败" });
  }
}
