import type { IncomingMessage, ServerResponse } from "http";
import { readJsonBody, sendJson } from "../../lib/http";
import type { BackendRequestContext } from "../auth/auth-context";
import { requireTenantContext } from "../auth/auth-controller";
import { tenantDeviceRepository } from "../../../../../packages/database/src/tenant-repositories";

export async function getDevices(res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const devices = await tenantDeviceRepository.list(context.tenantId!);
  sendJson(res, 200, { devices });
}

export async function postDevice(req: IncomingMessage, res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const body = (await readJsonBody(req)) as {
    id?: string;
    name?: string;
    type?: string;
    area?: string;
    installationLocation?: string;
    status?: string;
    lastReportAt?: string;
    notes?: string;
  };

  if (!body.name?.trim() || !body.type?.trim() || !body.area?.trim() || !body.installationLocation?.trim()) {
    sendJson(res, 400, { message: "设备名称、设备类型、所属区域和安装位置不能为空" });
    return;
  }

  try {
    const device = await tenantDeviceRepository.upsert(context.tenantId!, {
      ...body,
      name: body.name.trim(),
      type: body.type.trim(),
      area: body.area.trim(),
      installationLocation: body.installationLocation.trim(),
      status: body.status || "正常",
      lastReportAt: body.lastReportAt || "",
      notes: body.notes || "",
    });
    sendJson(res, 200, { device });
  } catch (error) {
    const message = error instanceof Error ? error.message : "设备保存失败";
    sendJson(res, 500, { message });
  }
}

export async function deleteDevice(
  req: IncomingMessage,
  res: ServerResponse,
  context: BackendRequestContext,
  url: URL,
) {
  if (!requireTenantContext(res, context)) return;
  const id = url.searchParams.get("id");
  if (!id) {
    sendJson(res, 400, { message: "设备 id 必填" });
    return;
  }
  await tenantDeviceRepository.remove(context.tenantId!, id);
  sendJson(res, 200, { success: true });
}
