import type { IncomingMessage, ServerResponse } from "http";
import { readJsonBody, sendJson } from "../../lib/http";
import type { BackendRequestContext } from "../auth/auth-context";
import { requireTenantContext } from "../auth/auth-controller";
import { tenantDutyRepository } from "../../../../../packages/database/src/tenant-repositories";

export async function getDutyCenter(res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const payload = await tenantDutyRepository.getCenterData(context.tenantId!);
  sendJson(res, 200, payload);
}

export async function postDutySchedule(
  req: IncomingMessage,
  res: ServerResponse,
  context: BackendRequestContext,
) {
  if (!requireTenantContext(res, context)) return;

  const body = (await readJsonBody(req)) as {
    dutyDate?: string;
    shiftId?: string;
    assigneeName?: string;
    assigneePhone?: string;
  };

  if (!body.dutyDate || !body.shiftId || !body.assigneeName || !body.assigneePhone) {
    sendJson(res, 400, { message: "排班参数不完整" });
    return;
  }

  await tenantDutyRepository.createSchedule(context.tenantId!, {
    dutyDate: body.dutyDate,
    shiftId: body.shiftId,
    assigneeName: body.assigneeName,
    assigneePhone: body.assigneePhone,
    assignedBy: context.userName ?? "backend_api",
  });

  const payload = await tenantDutyRepository.getCenterData(context.tenantId!);
  sendJson(res, 200, payload);
}

export async function patchDutyCenter(
  req: IncomingMessage,
  res: ServerResponse,
  context: BackendRequestContext,
) {
  if (!requireTenantContext(res, context)) return;

  const body = (await readJsonBody(req)) as {
    scheduleId?: string;
    nextScheduleId?: string;
    note?: string;
  };

  if (!body.scheduleId) {
    sendJson(res, 400, { message: "缺少当前班次记录" });
    return;
  }

  try {
    await tenantDutyRepository.handover(context.tenantId!, {
      scheduleId: body.scheduleId,
      nextScheduleId: body.nextScheduleId,
      note: body.note ?? "",
      operatorName: context.userName ?? "backend_api",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "HANDOVER_NOTE_REQUIRED") {
      sendJson(res, 400, { message: "存在未闭环报警时必须填写交接说明" });
      return;
    }
    throw error;
  }

  const payload = await tenantDutyRepository.getCenterData(context.tenantId!);
  sendJson(res, 200, payload);
}
