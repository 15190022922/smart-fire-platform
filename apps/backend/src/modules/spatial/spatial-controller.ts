import type { IncomingMessage, ServerResponse } from "http";
import {
  EntityNotFoundError,
  RepositoryError,
  TenantScopeError,
} from "../../../../../packages/database/src/errors";
import {
  tenantDevicePointRepository,
  tenantDrawingRepository,
  tenantFloorRepository,
  tenantOverviewRepository,
  tenantSpatialAreaRepository,
} from "../../../../../packages/database/src/tenant-repositories";
import { readJsonBody, sendJson } from "../../lib/http";
import type { BackendRequestContext } from "../auth/auth-context";
import { requireTenantContext } from "../auth/auth-controller";

type AreaStatus = "active" | "inactive";
type FloorPayload = {
  id?: string;
  name?: string;
  code?: string;
  levelIndex?: number;
  sortOrder?: number;
  status?: AreaStatus;
  description?: string;
};

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
    sendJson(res, 400, { message: "drawing target mismatch", code: "DRAWING_FLOOR_MISMATCH" });
    return;
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  sendJson(res, 500, { message });
}

function lastPathSegment(url: URL) {
  const parts = url.pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
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

export async function postTenantSpatialArea(req: IncomingMessage, res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const body = (await readJsonBody(req)) as {
    siteId?: string;
    name?: string;
    code?: string;
    areaType?: string;
    hasFloors?: boolean;
    sortOrder?: number;
    status?: AreaStatus;
    description?: string;
    floors?: FloorPayload[];
  };

  if (!body.name?.trim()) {
    sendJson(res, 400, { message: "name is required" });
    return;
  }

  try {
    const result = await tenantSpatialAreaRepository.create(context.tenantId!, {
      siteId: body.siteId,
      name: body.name.trim(),
      code: body.code,
      areaType: body.areaType,
      hasFloors: body.hasFloors,
      sortOrder: Number(body.sortOrder ?? 0),
      status: body.status,
      description: body.description,
      floors: Array.isArray(body.floors)
        ? body.floors
            .filter((floor) => floor.name?.trim())
            .map((floor) => ({
              id: floor.id,
              name: floor.name!.trim(),
              code: floor.code,
              levelIndex: floor.levelIndex,
              sortOrder: floor.sortOrder,
              status: floor.status,
              description: floor.description,
            }))
        : undefined,
      operatorName: context.userName ?? "tenant_console",
      operatorRole: context.userRole ?? "tenant_console",
    });
    sendJson(res, 200, result);
  } catch (error) {
    sendRepositoryError(res, error, "spatial area create failed");
  }
}

export async function patchTenantSpatialArea(req: IncomingMessage, res: ServerResponse, context: BackendRequestContext, url: URL) {
  if (!requireTenantContext(res, context)) return;
  const areaId = lastPathSegment(url);
  const body = (await readJsonBody(req)) as {
    siteId?: string;
    name?: string;
    code?: string;
    areaType?: string;
    hasFloors?: boolean;
    sortOrder?: number;
    status?: AreaStatus;
    description?: string;
    floors?: FloorPayload[];
    deletedFloorIds?: string[];
  };

  if (!areaId) {
    sendJson(res, 400, { message: "area id is required" });
    return;
  }

  try {
    const result = await tenantSpatialAreaRepository.update(context.tenantId!, areaId, {
      siteId: body.siteId,
      name: body.name,
      code: body.code,
      areaType: body.areaType,
      hasFloors: body.hasFloors,
      sortOrder: body.sortOrder,
      status: body.status,
      description: body.description,
      floors: Array.isArray(body.floors)
        ? body.floors
            .filter((floor) => floor.name?.trim())
            .map((floor) => ({
              id: floor.id,
              name: floor.name!.trim(),
              code: floor.code,
              levelIndex: floor.levelIndex,
              sortOrder: floor.sortOrder,
              status: floor.status,
              description: floor.description,
            }))
        : undefined,
      deletedFloorIds: Array.isArray(body.deletedFloorIds) ? body.deletedFloorIds : undefined,
      operatorName: context.userName ?? "tenant_console",
      operatorRole: context.userRole ?? "tenant_console",
    });
    sendJson(res, 200, result);
  } catch (error) {
    sendRepositoryError(res, error, "spatial area update failed");
  }
}

export async function deleteTenantSpatialArea(res: ServerResponse, context: BackendRequestContext, url: URL) {
  if (!requireTenantContext(res, context)) return;
  const areaId = lastPathSegment(url);
  if (!areaId) {
    sendJson(res, 400, { message: "area id is required" });
    return;
  }

  try {
    const result = await tenantSpatialAreaRepository.remove(context.tenantId!, areaId, {
      operatorName: context.userName ?? "tenant_console",
      operatorRole: context.userRole ?? "tenant_console",
    });
    sendJson(res, 200, result);
  } catch (error) {
    sendRepositoryError(res, error, "spatial area delete failed");
  }
}

export async function postTenantFloor(req: IncomingMessage, res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const body = (await readJsonBody(req)) as {
    buildingId?: string;
    name?: string;
    code?: string;
    levelIndex?: number;
    sortOrder?: number;
    status?: AreaStatus;
    description?: string;
  };

  if (!body.buildingId?.trim() || !body.name?.trim()) {
    sendJson(res, 400, { message: "buildingId and name are required" });
    return;
  }

  try {
    const floor = await tenantFloorRepository.create(context.tenantId!, {
      buildingId: body.buildingId.trim(),
      name: body.name.trim(),
      code: body.code,
      levelIndex: Number(body.levelIndex ?? 1),
      sortOrder: Number(body.sortOrder ?? body.levelIndex ?? 1),
      status: body.status,
      description: body.description,
      operatorName: context.userName ?? "tenant_console",
      operatorRole: context.userRole ?? "tenant_console",
    });
    sendJson(res, 200, { floor });
  } catch (error) {
    sendRepositoryError(res, error, "floor create failed");
  }
}

export async function patchTenantFloor(req: IncomingMessage, res: ServerResponse, context: BackendRequestContext, url: URL) {
  if (!requireTenantContext(res, context)) return;
  const floorId = lastPathSegment(url);
  const body = (await readJsonBody(req)) as {
    name?: string;
    code?: string;
    levelIndex?: number;
    sortOrder?: number;
    status?: AreaStatus;
    description?: string;
  };

  if (!floorId) {
    sendJson(res, 400, { message: "floor id is required" });
    return;
  }

  try {
    const floor = await tenantFloorRepository.update(context.tenantId!, floorId, {
      name: body.name,
      code: body.code,
      levelIndex: body.levelIndex,
      sortOrder: body.sortOrder,
      status: body.status,
      description: body.description,
      operatorName: context.userName ?? "tenant_console",
      operatorRole: context.userRole ?? "tenant_console",
    });
    sendJson(res, 200, { floor });
  } catch (error) {
    sendRepositoryError(res, error, "floor update failed");
  }
}

export async function deleteTenantFloor(res: ServerResponse, context: BackendRequestContext, url: URL) {
  if (!requireTenantContext(res, context)) return;
  const floorId = lastPathSegment(url);
  if (!floorId) {
    sendJson(res, 400, { message: "floor id is required" });
    return;
  }

  try {
    const result = await tenantFloorRepository.remove(context.tenantId!, floorId, {
      operatorName: context.userName ?? "tenant_console",
      operatorRole: context.userRole ?? "tenant_console",
    });
    sendJson(res, 200, result);
  } catch (error) {
    sendRepositoryError(res, error, "floor delete failed");
  }
}

export async function getTenantDrawings(res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const drawings = await tenantDrawingRepository.list(context.tenantId!);
  sendJson(res, 200, { drawings });
}

export async function postTenantDrawing(req: IncomingMessage, res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const body = (await readJsonBody(req)) as {
    buildingId?: string;
    floorId?: string;
    name?: string;
    fileUrl?: string;
    fileType?: "image" | "pdf";
    sourceFileUrl?: string;
    previewUrl?: string;
    originalFileName?: string;
    fileSize?: number;
    processingStatus?: "processing" | "ready" | "failed";
    processingMessage?: string;
    conversionLog?: string[];
    sceneUrl?: string;
    width?: number;
    height?: number;
    version?: string;
    status?: "draft" | "published" | "archived";
  };

  if (!(body.buildingId?.trim() || body.floorId?.trim()) || !body.name?.trim() || !body.fileUrl?.trim()) {
    sendJson(res, 400, { message: "buildingId or floorId, name and fileUrl are required" });
    return;
  }

  try {
    const drawing = await tenantDrawingRepository.create(context.tenantId!, {
      buildingId: body.buildingId?.trim(),
      floorId: body.floorId?.trim(),
      name: body.name.trim(),
      fileUrl: body.fileUrl.trim(),
      fileType: body.fileType,
      sourceFileUrl: body.sourceFileUrl?.trim(),
      previewUrl: body.previewUrl?.trim(),
      originalFileName: body.originalFileName?.trim(),
      fileSize: Number(body.fileSize ?? 0),
      processingStatus: body.processingStatus,
      processingMessage: body.processingMessage?.trim(),
      conversionLog: Array.isArray(body.conversionLog) ? body.conversionLog : [],
      sceneUrl: body.sceneUrl?.trim(),
      width: Number(body.width ?? 0),
      height: Number(body.height ?? 0),
      version: String(body.version ?? "v1.0"),
      status: body.status,
      operatorName: context.userName ?? "tenant_console",
      operatorRole: context.userRole ?? "tenant_console",
    });
    sendJson(res, 200, { drawing });
  } catch (error) {
    sendRepositoryError(res, error, "drawing save failed");
  }
}

export async function publishTenantDrawing(url: URL, res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const parts = url.pathname.split("/");
  const drawingId = parts[parts.length - 2];
  if (!drawingId) {
    sendJson(res, 400, { message: "drawing id is required" });
    return;
  }

  try {
    const drawing = await tenantDrawingRepository.updateStatus(context.tenantId!, drawingId, "published", {
      operatorName: context.userName ?? "tenant_console",
      operatorRole: context.userRole ?? "tenant_console",
    });
    sendJson(res, 200, { drawing });
  } catch (error) {
    sendRepositoryError(res, error, "drawing publish failed");
  }
}

export async function archiveTenantDrawing(url: URL, res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const parts = url.pathname.split("/");
  const drawingId = parts[parts.length - 2];
  if (!drawingId) {
    sendJson(res, 400, { message: "drawing id is required" });
    return;
  }

  try {
    const drawing = await tenantDrawingRepository.updateStatus(context.tenantId!, drawingId, "archived", {
      operatorName: context.userName ?? "tenant_console",
      operatorRole: context.userRole ?? "tenant_console",
    });
    sendJson(res, 200, { drawing });
  } catch (error) {
    sendRepositoryError(res, error, "drawing archive failed");
  }
}

export async function deleteTenantDrawing(url: URL, res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const drawingId = url.searchParams.get("id");
  if (!drawingId) {
    sendJson(res, 400, { message: "drawing id is required" });
    return;
  }

  try {
    const result = await tenantDrawingRepository.remove(context.tenantId!, drawingId, {
      operatorName: context.userName ?? "tenant_console",
      operatorRole: context.userRole ?? "tenant_console",
    });
    sendJson(res, 200, result);
  } catch (error) {
    sendRepositoryError(res, error, "drawing delete failed");
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
    buildingId?: string;
    floorId?: string;
    drawingId?: string;
    x?: number;
    y?: number;
    rotation?: number;
    icon?: string;
    statusStyle?: "normal" | "alarm" | "fault" | "offline";
  };

  if (!body.deviceId || !body.drawingId) {
    sendJson(res, 400, { message: "deviceId and drawingId are required" });
    return;
  }

  try {
    const point = await tenantDevicePointRepository.upsert(context.tenantId!, {
      id: body.id,
      deviceId: body.deviceId,
      buildingId: body.buildingId,
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
    sendRepositoryError(res, error, "device point save failed");
  }
}

export async function deleteTenantDevicePoint(url: URL, res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const pointId = url.searchParams.get("id");
  if (!pointId) {
    sendJson(res, 400, { message: "point id is required" });
    return;
  }

  try {
    const result = await tenantDevicePointRepository.remove(context.tenantId!, pointId, {
      operatorName: context.userName ?? "tenant_console",
      operatorRole: context.userRole ?? "tenant_console",
    });
    sendJson(res, 200, result);
  } catch (error) {
    sendRepositoryError(res, error, "device point delete failed");
  }
}
