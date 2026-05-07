"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminPlatformNotices = getAdminPlatformNotices;
exports.postAdminPlatformNotice = postAdminPlatformNotice;
exports.postAdminPlatformNoticeDraft = postAdminPlatformNoticeDraft;
exports.patchAdminPlatformNotice = patchAdminPlatformNotice;
exports.publishAdminPlatformNoticeDraft = publishAdminPlatformNoticeDraft;
exports.reeditAdminPlatformNoticeDraft = reeditAdminPlatformNoticeDraft;
exports.revokeAdminPlatformNotice = revokeAdminPlatformNotice;
exports.deleteAdminPlatformNotice = deleteAdminPlatformNotice;
exports.getTenantPlatformNotices = getTenantPlatformNotices;
exports.getTenantPlatformNoticeDetail = getTenantPlatformNoticeDetail;
exports.patchTenantPlatformNoticeState = patchTenantPlatformNoticeState;
const ops_repositories_1 = require("../../../../../packages/database/src/ops-repositories");
const http_1 = require("../../lib/http");
const auth_controller_1 = require("../auth/auth-controller");
async function getAdminPlatformNotices(res, context) {
    if (!(0, auth_controller_1.requirePlatformContext)(res, context))
        return;
    const notices = await ops_repositories_1.platformNoticeRepository.listPlatformNotices();
    (0, http_1.sendJson)(res, 200, { notices });
}
async function postAdminPlatformNotice(req, res, context) {
    if (!(0, auth_controller_1.requirePlatformContext)(res, context))
        return;
    const body = (await (0, http_1.readJsonBody)(req));
    try {
        const result = await ops_repositories_1.platformNoticeRepository.createPlatformNotice({
            ...body,
            senderName: context.userName,
            senderRole: context.userRole,
        });
        (0, http_1.sendJson)(res, 200, result);
    }
    catch (error) {
        (0, http_1.sendJson)(res, 400, { message: error instanceof Error ? error.message : "Failed to create platform notice" });
    }
}
async function postAdminPlatformNoticeDraft(req, res, context) {
    if (!(0, auth_controller_1.requirePlatformContext)(res, context))
        return;
    const body = await (0, http_1.readJsonBody)(req);
    try {
        const result = await ops_repositories_1.platformNoticeRepository.createPlatformNoticeDraft({
            ...body,
            senderName: context.userName,
            senderRole: context.userRole,
        });
        (0, http_1.sendJson)(res, 200, result);
    }
    catch (error) {
        (0, http_1.sendJson)(res, 400, { message: error instanceof Error ? error.message : "Failed to save platform notice draft" });
    }
}
async function patchAdminPlatformNotice(req, res, context, noticeId) {
    if (!(0, auth_controller_1.requirePlatformContext)(res, context))
        return;
    const body = await (0, http_1.readJsonBody)(req);
    try {
        const result = await ops_repositories_1.platformNoticeRepository.updatePlatformNoticeDraft(noticeId, {
            ...body,
            senderName: context.userName,
            senderRole: context.userRole,
        });
        (0, http_1.sendJson)(res, 200, result);
    }
    catch (error) {
        (0, http_1.sendJson)(res, 400, { message: error instanceof Error ? error.message : "Failed to update platform notice draft" });
    }
}
async function publishAdminPlatformNoticeDraft(req, res, context, noticeId) {
    if (!(0, auth_controller_1.requirePlatformContext)(res, context))
        return;
    const body = (await (0, http_1.readJsonBody)(req));
    try {
        const result = await ops_repositories_1.platformNoticeRepository.publishPlatformNoticeDraft(noticeId, {
            requestId: body.requestId,
            actorName: context.userName,
            actorRole: context.userRole,
        });
        (0, http_1.sendJson)(res, 200, result);
    }
    catch (error) {
        (0, http_1.sendJson)(res, 400, { message: error instanceof Error ? error.message : "Failed to publish platform notice draft" });
    }
}
async function reeditAdminPlatformNoticeDraft(res, context, noticeId) {
    if (!(0, auth_controller_1.requirePlatformContext)(res, context))
        return;
    try {
        const result = await ops_repositories_1.platformNoticeRepository.createReeditDraftFromNotice(noticeId, {
            actorName: context.userName,
            actorRole: context.userRole,
        });
        (0, http_1.sendJson)(res, 200, result);
    }
    catch (error) {
        (0, http_1.sendJson)(res, 400, { message: error instanceof Error ? error.message : "Failed to create reedit draft" });
    }
}
async function revokeAdminPlatformNotice(req, res, context, noticeId) {
    if (!(0, auth_controller_1.requirePlatformContext)(res, context))
        return;
    const body = (await (0, http_1.readJsonBody)(req));
    try {
        const result = await ops_repositories_1.platformNoticeRepository.revokePlatformNotice(noticeId, {
            reason: body.reason,
            actorName: context.userName,
            actorRole: context.userRole,
        });
        (0, http_1.sendJson)(res, 200, result);
    }
    catch (error) {
        (0, http_1.sendJson)(res, 400, { message: error instanceof Error ? error.message : "Failed to revoke platform notice" });
    }
}
async function deleteAdminPlatformNotice(res, context, noticeId) {
    if (!(0, auth_controller_1.requirePlatformContext)(res, context))
        return;
    try {
        const result = await ops_repositories_1.platformNoticeRepository.deletePlatformNotice(noticeId, {
            actorName: context.userName,
            actorRole: context.userRole,
        });
        (0, http_1.sendJson)(res, 200, result);
    }
    catch (error) {
        (0, http_1.sendJson)(res, 400, { message: error instanceof Error ? error.message : "Failed to delete platform notice" });
    }
}
async function getTenantPlatformNotices(url, res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const result = await ops_repositories_1.platformNoticeRepository.listTenantPlatformNoticeDeliveries(context.tenantId, {
        page: Number(url.searchParams.get("page") ?? 1),
        pageSize: Number(url.searchParams.get("pageSize") ?? 20),
        keyword: url.searchParams.get("keyword") ?? undefined,
        level: url.searchParams.get("level") ?? undefined,
        from: url.searchParams.get("from") ?? undefined,
        to: url.searchParams.get("to") ?? undefined,
        hasAttachments: url.searchParams.get("hasAttachments") === "true",
        state: url.searchParams.get("state") ?? "all",
        userName: context.userName,
    });
    (0, http_1.sendJson)(res, 200, result);
}
async function getTenantPlatformNoticeDetail(res, context, noticeId) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    try {
        const notice = await ops_repositories_1.platformNoticeRepository.getTenantPlatformNoticeDetail(context.tenantId, noticeId, context.userName);
        (0, http_1.sendJson)(res, 200, { notice });
    }
    catch (error) {
        (0, http_1.sendJson)(res, 404, { message: error instanceof Error ? error.message : "Platform notice not found" });
    }
}
async function patchTenantPlatformNoticeState(req, res, context, noticeId) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    const body = (await (0, http_1.readJsonBody)(req));
    const action = body.action === "archive" || body.action === "unarchive" ? body.action : "read";
    try {
        const result = await ops_repositories_1.platformNoticeRepository.updateTenantPlatformNoticeState(context.tenantId, noticeId, context.userName, action);
        (0, http_1.sendJson)(res, 200, result);
    }
    catch (error) {
        (0, http_1.sendJson)(res, 400, { message: error instanceof Error ? error.message : "Failed to update notice state" });
    }
}
