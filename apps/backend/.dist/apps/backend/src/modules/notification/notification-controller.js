"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNotificationCenter = getNotificationCenter;
const tenant_repositories_1 = require("../../../../../packages/database/src/tenant-repositories");
const http_1 = require("../../lib/http");
const auth_controller_1 = require("../auth/auth-controller");
async function getNotificationCenter(res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const payload = await tenant_repositories_1.tenantNotificationRepository.getCenterData(context.tenantId);
    (0, http_1.sendJson)(res, 200, payload);
}
