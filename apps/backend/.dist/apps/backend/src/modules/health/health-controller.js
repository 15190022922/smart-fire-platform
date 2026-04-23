"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSystemHealth = getSystemHealth;
exports.getBackendHealth = getBackendHealth;
exports.getTenantOverview = getTenantOverview;
exports.getTenantSpatialModel = getTenantSpatialModel;
const tenant_repositories_1 = require("../../../../../packages/database/src/tenant-repositories");
const http_1 = require("../../lib/http");
const auth_controller_1 = require("../auth/auth-controller");
async function getSystemHealth(res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const payload = await tenant_repositories_1.tenantHealthRepository.getPayload(context.tenantId);
    (0, http_1.sendJson)(res, 200, payload);
}
async function getBackendHealth(res) {
    (0, http_1.sendJson)(res, 200, {
        service: "backend",
        status: "ok",
        time: new Date().toISOString(),
    });
}
async function getTenantOverview(res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const payload = await tenant_repositories_1.tenantOverviewRepository.getOverview(context.tenantId);
    (0, http_1.sendJson)(res, 200, payload);
}
async function getTenantSpatialModel(res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const payload = await tenant_repositories_1.tenantOverviewRepository.getSpatialModel(context.tenantId);
    (0, http_1.sendJson)(res, 200, payload);
}
