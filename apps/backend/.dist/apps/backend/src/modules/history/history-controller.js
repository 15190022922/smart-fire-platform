"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTenantHistory = getTenantHistory;
const ops_repositories_1 = require("../../../../../packages/database/src/ops-repositories");
const http_1 = require("../../lib/http");
const auth_controller_1 = require("../auth/auth-controller");
async function getTenantHistory(res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const payload = await ops_repositories_1.historyRepository.getTenantHistoryData(context.tenantId);
    (0, http_1.sendJson)(res, 200, payload);
}
