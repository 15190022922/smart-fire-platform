"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminState = getAdminState;
exports.putAdminState = putAdminState;
exports.postAdminTenant = postAdminTenant;
exports.putAdminTenant = putAdminTenant;
exports.deleteAdminTenant = deleteAdminTenant;
const ops_repositories_1 = require("../../../../../packages/database/src/ops-repositories");
const password_1 = require("../../../../../lib/password");
const http_1 = require("../../lib/http");
const auth_controller_1 = require("../auth/auth-controller");
async function getAdminState(res, context) {
    if (!(0, auth_controller_1.requirePlatformContext)(res, context))
        return;
    const payload = await ops_repositories_1.adminRepository.getAdminStateData();
    (0, http_1.sendJson)(res, 200, payload);
}
async function putAdminState(req, res, context) {
    if (!(0, auth_controller_1.requirePlatformContext)(res, context))
        return;
    const body = await (0, http_1.readJsonBody)(req);
    await ops_repositories_1.adminRepository.replaceAdminStateData(body);
    (0, http_1.sendJson)(res, 200, { success: true });
}
async function postAdminTenant(req, res, context) {
    if (!(0, auth_controller_1.requirePlatformContext)(res, context))
        return;
    const body = (await (0, http_1.readJsonBody)(req));
    try {
        const result = await ops_repositories_1.adminRepository.createTenantWithAdminRecord({
            tenant: body.tenant,
            admin: {
                ...body.admin,
                passwordHash: (0, password_1.hashPassword)(body.admin.password),
            },
        });
        (0, http_1.sendJson)(res, 200, result);
    }
    catch (error) {
        const message = error instanceof Error && /duplicate key|already exists|unique/i.test(error.message)
            ? "企业编码或管理员登录账号已存在"
            : "创建企业失败";
        (0, http_1.sendJson)(res, 400, { message });
    }
}
async function putAdminTenant(req, res, context) {
    if (!(0, auth_controller_1.requirePlatformContext)(res, context))
        return;
    const body = await (0, http_1.readJsonBody)(req);
    try {
        const tenant = await ops_repositories_1.adminRepository.updateTenantRecord(body);
        (0, http_1.sendJson)(res, 200, { tenant });
    }
    catch {
        (0, http_1.sendJson)(res, 400, { message: "修改企业失败" });
    }
}
async function deleteAdminTenant(url, res, context) {
    if (!(0, auth_controller_1.requirePlatformContext)(res, context))
        return;
    const tenantId = url.searchParams.get("tenantId");
    if (!tenantId) {
        (0, http_1.sendJson)(res, 400, { message: "缺少企业 ID" });
        return;
    }
    await ops_repositories_1.adminRepository.deleteTenantCascadeRecord(tenantId);
    (0, http_1.sendJson)(res, 200, { success: true });
}
