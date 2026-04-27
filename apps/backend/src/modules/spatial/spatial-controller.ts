import type { IncomingMessage, ServerResponse } from "http";
import {
  EntityNotFoundError,
  RepositoryError,
  TenantScopeError,
} from "../../../../../packages/database/src/errors";
import {
  tenantDevicePointRepository,
  tenantDrawingRepository,
  tenantOverviewRepository,
} from "../../../../../packages/database/src/tenant-repositories";
import { readJsonBody, sendJson } from "../../lib/http";
import type { BackendRequestContext } from "../auth/auth-context";
import { requireTenantContext } from "../auth/auth-controller";

function sendRepositoryError(res: ServerResponse, error: unknown, fallbackMessage: string) {
  if (error instanceof EntityNotFoundError) {
    sendJson(res, 404, { message: error.message, code: error.code });
    return;
  }
  if (error instanceof TenantScopeError) {
    sendJson(res, 403, { message: error.message, code: error.code });
    return;
  }
  if (error instanceof RepositoryError) {
    sendJson(res, 400, { message: error.message, code: error.code });
    return;
  }
  if (error instanceof Error && error.message === "DRAWING_FLOOR_MISMATCH") {
    sendJson(res, 400, { message: "图纸与楼层不匹配", code: "DRAWING_FLOOR_MISMATCH" });
    return;
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  sendJson(res, 500, { message });
}

export async function getTenantOverview(res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const payload = await tenantOverviewRepository.getOverview(context.tenantId!);
  sendJson(res, 200, payload);
}

export async function getTenantSpatialModel(res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const payload = await tenantOverviewRepository.getSpatialModel(context.tenantId!);
  sendJson(res, 200, payload);
}

export async function getTenantDrawings(res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const drawings = await tenantDrawingRepository.list(context.tenantId!);
  sendJson(res, 200, { drawings });
}

export async function postTenantDrawing(req: IncomingMessage, res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const body = (await readJsonBody(req)) as {
    floorId?: string;
    name?: string;
    fileUrl?: string;
    width?: number;
    height?: number;
    version?: string;
    status?: "draft" | "published" | "archived";
  };

  if (!body.floorId || !body.name?.trim() || !body.fileUrl?.trim()) {
    sendJson(res, 400, { message: "floorId、name、fileUrl 必填" });
    return;
  }

  try {
    const drawing = await tenantDrawingRepository.create(context.tenantId!, {
      floorId: body.floorId,
      name: body.name.trim(),
      fileUrl: body.fileUrl.trim(),
      width: Number(body.width ?? 0),
      height: Number(body.height ?? 0),
      version: String(body.version ?? "v1.0"),
      status: body.status,
      operatorName: context.userName ?? "tenant_console",
      operatorRole: context.userRole ?? "tenant_console",
    });
    sendJson(res, 200, { drawing });
  } catch (error) {
    sendRepositoryError(res, error, "图纸保存失败");
  }
}

export async function deleteTenantDrawing(url: URL, res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const drawingId = url.searchParams.get("id");
  if (!drawingId) {
    sendJson(res, 400, { message: "缺少图纸 ID" });
    return;
  }

  try {
    const result = await tenantDrawingRepository.remove(context.tenantId!, drawingId, {
      operatorName: context.userName ?? "tenant_console",
      operatorRole: context.userRole ?? "tenant_console",
    });
    sendJson(res, 200, result);
  } catch (error) {
    sendRepositoryError(res, error, "图纸删除失败");
  }
}

export async function getTenantDevicePoints(res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const points = await tenantDevicePointRepository.list(context.tenantId!);
  sendJson(res, 200, { points });
}

export async function postTenantDevicePoint(req: IncomingMessage, res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const body = (await readJsonBody(req)) as {
    id?: string;
    deviceId?: string;
    floorId?: string;
    drawingId?: string;
    x?: number;
    y?: number;
    rotation?: number;
    icon?: string;
    statusStyle?: "normal" | "alarm" | "fault" | "offline";
  };

  if (!body.deviceId || !body.floorId || !body.drawingId) {
    sendJson(res, 400, { message: "deviceId、floorId、drawingId 必填" });
    return;
  }

  try {
    const point = await tenantDevicePointRepository.upsert(context.tenantId!, {
      id: body.id,
      deviceId: body.deviceId,
      floorId: body.floorId,
      drawingId: body.drawingId,
      x: Number(body.x ?? 0),
      y: Number(body.y ?? 0),
      rotation: Number(body.rotation ?? 0),
      icon: body.icon,
      statusStyle: body.statusStyle,
      operatorName: context.userName ?? "tenant_console",
      operatorRole: context.userRole ?? "tenant_console",
    });
    sendJson(res, 200, { point });
  } catch (error) {
    sendRepositoryError(res, error, "点位保存失败");
  }
}

export async function deleteTenantDevicePoint(url: URL, res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const pointId = url.searchParams.get("id");
  if (!pointId) {
    sendJson(res, 400, { message: "缺少点位 ID" });
    return;
  }

  try {
    const result = await tenantDevicePointRepository.remove(context.tenantId!, pointId, {
      operatorName: context.userName ?? "tenant_console",
      operatorRole: context.userRole ?? "tenant_console",
    });
    sendJson(res, 200, result);
  } catch (error) {
    sendRepositoryError(res, error, "点位删除失败");
  }
}
