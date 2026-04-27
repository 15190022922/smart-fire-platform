import type { ServerResponse } from "http";
import { platformRepository, tenantSceneRepository } from "../../../../../packages/database/src/ops-repositories";
import { sendJson } from "../../lib/http";
import type { BackendRequestContext } from "../auth/auth-context";
import { requirePlatformContext } from "../auth/auth-controller";

export async function getPlatformOverview(res: ServerResponse, context: BackendRequestContext) {
  if (!requirePlatformContext(res, context)) return;
  const payload = await platformRepository.getPlatformOverviewData();
  sendJson(res, 200, payload);
}

export async function getPlatformTenants(res: ServerResponse, context: BackendRequestContext) {
  if (!requirePlatformContext(res, context)) return;
  const overview = await platformRepository.getPlatformOverviewData();
  sendJson(res, 200, {
    tenants: overview.tenants,
    subscriptions: overview.subscriptions,
    plans: overview.plans,
  });
}

export async function getPlatformTenantScene(url: URL, res: ServerResponse, context: BackendRequestContext) {
  if (!requirePlatformContext(res, context)) return;
  const tenantId = url.searchParams.get("tenantId");
  if (!tenantId) {
    sendJson(res, 400, { message: "缺少 tenantId" });
    return;
  }

  const scene = await tenantSceneRepository.getPlatformTenantScene(tenantId);
  if (!scene) {
    sendJson(res, 404, { message: "未找到企业" });
    return;
  }

  sendJson(res, 200, scene);
}
