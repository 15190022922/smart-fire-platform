"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireTenantContext = requireTenantContext;
exports.requirePlatformContext = requirePlatformContext;
exports.getAuthSessionHandler = getAuthSessionHandler;
const http_1 = require("../../lib/http");
function requireTenantContext(res, context) {
    if (!context.tenantId || context.scope !== "tenant") {
        (0, http_1.sendJson)(res, 403, { message: "无权访问企业接口" });
        return false;
    }
    return true;
}
function requirePlatformContext(res, context) {
    if (context.scope !== "platform") {
        (0, http_1.sendJson)(res, 403, { message: "无权访问平台接口" });
        return false;
    }
    return true;
}
function getAuthSessionHandler(res, context) {
    (0, http_1.sendJson)(res, 200, {
        session: context.session,
        tenantId: context.tenantId,
        scope: context.scope,
        userName: context.userName,
        userRole: context.userRole,
    });
}
