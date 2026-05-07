import type { IncomingMessage, ServerResponse } from "http";
import { readJsonBody, sendJson } from "../../lib/http";
import type { BackendRequestContext } from "../auth/auth-context";
import { requireTenantContext } from "../auth/auth-controller";
import {
  tenantDeviceAttributeRepository,
  tenantDeviceImportRepository,
  tenantDeviceRepository,
} from "../../../../../packages/database/src/tenant-repositories";
import { publishTenantEvent } from "../../../../../packages/realtime/src/server";

export async function getDevices(res: ServerResponse, context: BackendRequestContext, url: URL) {
  if (!requireTenantContext(res, context)) return;
  const lifecycle = url.searchParams.get("lifecycle") ?? "active";
  const devices = await tenantDeviceRepository.list(context.tenantId!, lifecycle === "disabled" || lifecycle === "all" ? lifecycle : "active");
  sendJson(res, 200, { devices });
}

export async function postDevice(req: IncomingMessage, res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const body = (await readJsonBody(req)) as {
    id?: string;
    deviceCode?: string;
    name?: string;
    type?: string;
    area?: string;
    installationLocation?: string;
    status?: string;
    installationStatus?: string;
    lastReportAt?: string;
    notes?: string;
    customAttributes?: Record<string, string | number | boolean | null>;
  };

  if (
    !body.deviceCode?.trim() ||
    !body.name?.trim() ||
    !body.type?.trim() ||
    !body.area?.trim() ||
    !body.installationLocation?.trim()
  ) {
    sendJson(res, 400, { message: "设备编码、设备名称、设备类型、所属区域和安装位置不能为空" });
    return;
  }

  try {
    const device = await tenantDeviceRepository.upsert(context.tenantId!, {
      ...body,
      deviceCode: body.deviceCode.trim(),
      name: body.name.trim(),
      type: body.type.trim(),
      area: body.area.trim(),
      installationLocation: body.installationLocation.trim(),
      status: body.status || "正常",
      installationStatus: body.installationStatus || "",
      lastReportAt: body.lastReportAt || "",
      notes: body.notes || "",
      customAttributes: body.customAttributes ?? {},
    });
    publishTenantEvent(context.tenantId!, {
      type: "device_status_changed",
      tenantId: context.tenantId!,
      deviceId: device.id,
      eventType: body.id ? "device_updated" : "device_created",
      eventCode: body.id ? "DEVICE_UPDATED" : "DEVICE_CREATED",
      reportedAt: device.lastReportAt,
      occurredAt: device.lastReportAt,
      source: "tenant_console",
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
  const occurredAt = new Date().toISOString();
  publishTenantEvent(context.tenantId!, {
    type: "device_status_changed",
    tenantId: context.tenantId!,
    deviceId: id,
    eventType: "device_deleted",
    eventCode: "DEVICE_DELETED",
    reportedAt: occurredAt,
    occurredAt,
    source: "tenant_console",
  });
  sendJson(res, 200, { success: true });
}

export async function previewDeviceLifecycle(req: IncomingMessage, res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const body = await readJsonBody(req);
  const preview = await tenantDeviceRepository.previewLifecycle(context.tenantId!, body);
  sendJson(res, 200, preview);
}

export async function updateDeviceLifecycle(req: IncomingMessage, res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const body = await readJsonBody(req);
  const result = await tenantDeviceRepository.updateLifecycle(context.tenantId!, body);
  const occurredAt = new Date().toISOString();
  publishTenantEvent(context.tenantId!, {
    type: "device_status_changed",
    tenantId: context.tenantId!,
    eventType: "device_lifecycle_changed",
    eventCode: "DEVICE_LIFECYCLE_CHANGED",
    reportedAt: occurredAt,
    occurredAt,
    source: "tenant_console",
  });
  sendJson(res, 200, result);
}

export async function getDeviceAttributes(res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const attributes = await tenantDeviceAttributeRepository.list(context.tenantId!);
  sendJson(res, 200, { attributes });
}

export async function postDeviceAttribute(req: IncomingMessage, res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const body = await readJsonBody(req);
  try {
    const attribute = await tenantDeviceAttributeRepository.upsert(context.tenantId!, body);
    sendJson(res, 200, { attribute });
  } catch (error) {
    const message = error instanceof Error ? error.message : "设备字段保存失败";
    sendJson(res, 400, { message });
  }
}

export async function deleteDeviceAttribute(res: ServerResponse, context: BackendRequestContext, url: URL) {
  if (!requireTenantContext(res, context)) return;
  const fieldKey = url.searchParams.get("fieldKey");
  if (!fieldKey) {
    sendJson(res, 400, { message: "字段 key 必填" });
    return;
  }

  try {
    await tenantDeviceAttributeRepository.disable(context.tenantId!, fieldKey);
    sendJson(res, 200, { success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "设备字段停用失败";
    sendJson(res, 400, { message });
  }
}

export async function previewDeviceImport(req: IncomingMessage, res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const body = await readJsonBody(req);
  const preview = await tenantDeviceImportRepository.preview(context.tenantId!, body);
  sendJson(res, 200, preview);
}

export async function commitDeviceImport(req: IncomingMessage, res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const body = await readJsonBody(req);
  const result = await tenantDeviceImportRepository.commit(context.tenantId!, body);
  const occurredAt = new Date().toISOString();
  publishTenantEvent(context.tenantId!, {
    type: "device_status_changed",
    tenantId: context.tenantId!,
    eventType: "device_imported",
    eventCode: "DEVICE_IMPORT_IMPORTED",
    reportedAt: occurredAt,
    occurredAt,
    source: "tenant_console",
  });
  sendJson(res, 200, result);
}
