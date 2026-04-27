"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlatformOverview = getPlatformOverview;
exports.getPlatformTenants = getPlatformTenants;
exports.getPlatformTenantScene = getPlatformTenantScene;
const ops_repositories_1 = require("../../../../../packages/database/src/ops-repositories");
const http_1 = require("../../lib/http");
const auth_controller_1 = require("../auth/auth-controller");
async function getPlatformOverview(res, context) {
    if (!(0, auth_controller_1.requirePlatformContext)(res, context))
        return;
    const payload = await ops_repositories_1.platformRepository.getPlatformOverviewData();
    (0, http_1.sendJson)(res, 200, payload);
}
async function getPlatformTenants(res, context) {
    if (!(0, auth_controller_1.requirePlatformContext)(res, context))
        return;
    const overview = await ops_repositories_1.platformRepository.getPlatformOverviewData();
    (0, http_1.sendJson)(res, 200, {
        tenants: overview.tenants,
        subscriptions: overview.subscriptions,
        plans: overview.plans,
    });
}
async function getPlatformTenantScene(url, res, context) {
    if (!(0, auth_controller_1.requirePlatformContext)(res, context))
        return;
    const tenantId = url.searchParams.get("tenantId");
    if (!tenantId) {
        (0, http_1.sendJson)(res, 400, { message: "缺少 tenantId" });
        return;
    }
    const scene = await ops_repositories_1.tenantSceneRepository.getPlatformTenantScene(tenantId);
    if (!scene) {
        (0, http_1.sendJson)(res, 404, { message: "未找到企业" });
        return;
    }
    (0, http_1.sendJson)(res, 200, scene);
}
