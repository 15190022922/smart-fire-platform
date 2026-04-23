import type { ServerResponse } from "http";
import { tenantHealthRepository, tenantOverviewRepository } from "../../../../../packages/database/src/tenant-repositories";
import { sendJson } from "../../lib/http";
import type { BackendRequestContext } from "../auth/auth-context";
import { requireTenantContext } from "../auth/auth-controller";

export async function getSystemHealth(res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const payload = await tenantHealthRepository.getPayload(context.tenantId!);
  sendJson(res, 200, payload);
}

export async function getBackendHealth(res: ServerResponse) {
  sendJson(res, 200, {
    service: "backend",
    status: "ok",
    time: new Date().toISOString(),
  });
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
