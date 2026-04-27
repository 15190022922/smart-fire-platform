"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUsers = getUsers;
exports.postUser = postUser;
exports.deleteUser = deleteUser;
const tenant_repositories_1 = require("../../../../../packages/database/src/tenant-repositories");
const http_1 = require("../../lib/http");
const auth_controller_1 = require("../auth/auth-controller");
async function getUsers(res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const users = await tenant_repositories_1.tenantUserRepository.list(context.tenantId);
    (0, http_1.sendJson)(res, 200, { users });
}
async function postUser(req, res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const body = await (0, http_1.readJsonBody)(req);
    const user = await tenant_repositories_1.tenantUserRepository.upsert(context.tenantId, body);
    (0, http_1.sendJson)(res, 200, { user });
}
async function deleteUser(url, res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const id = url.searchParams.get("id");
    if (!id) {
        (0, http_1.sendJson)(res, 400, { message: "缺少用户 ID" });
        return;
    }
    await tenant_repositories_1.tenantUserRepository.remove(context.tenantId, id);
    (0, http_1.sendJson)(res, 200, { success: true });
}
