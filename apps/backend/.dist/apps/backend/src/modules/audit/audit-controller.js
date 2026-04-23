"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuditLogs = getAuditLogs;
const tenant_repositories_1 = require("../../../../../packages/database/src/tenant-repositories");
const http_1 = require("../../lib/http");
const auth_controller_1 = require("../auth/auth-controller");
async function getAuditLogs(res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const logs = await tenant_repositories_1.tenantAuditRepository.list(context.tenantId);
    (0, http_1.sendJson)(res, 200, { logs });
}
