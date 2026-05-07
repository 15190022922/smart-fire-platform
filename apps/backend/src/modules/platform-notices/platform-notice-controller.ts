import type { IncomingMessage, ServerResponse } from "http";
import { platformNoticeRepository } from "../../../../../packages/database/src/ops-repositories";
import { readJsonBody, sendJson } from "../../lib/http";
import type { BackendRequestContext } from "../auth/auth-context";
import { requirePlatformContext, requireTenantContext } from "../auth/auth-controller";

export async function getAdminPlatformNotices(res: ServerResponse, context: BackendRequestContext) {
  if (!requirePlatformContext(res, context)) return;
  const notices = await platformNoticeRepository.listPlatformNotices();
  sendJson(res, 200, { notices });
}

export async function postAdminPlatformNotice(
  req: IncomingMessage,
  res: ServerResponse,
  context: BackendRequestContext,
) {
  if (!requirePlatformContext(res, context)) return;
  const body = (await readJsonBody(req)) as {
    title?: string;
    content?: string;
    level?: string;
    targetMode?: string;
    tenantIds?: string[];
    attachmentIds?: string[];
    requestId?: string;
    attachments?: {
      id: string;
      name: string;
      url: string;
      size: number;
      contentType: string;
    }[];
  };

  try {
    const result = await platformNoticeRepository.createPlatformNotice({
      ...body,
      senderName: context.userName,
      senderRole: context.userRole,
    });
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, 400, { message: error instanceof Error ? error.message : "Failed to create platform notice" });
  }
}

export async function postAdminPlatformNoticeDraft(
  req: IncomingMessage,
  res: ServerResponse,
  context: BackendRequestContext,
) {
  if (!requirePlatformContext(res, context)) return;
  const body = await readJsonBody(req);
  try {
    const result = await platformNoticeRepository.createPlatformNoticeDraft({
      ...(body as object),
      senderName: context.userName,
      senderRole: context.userRole,
    });
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, 400, { message: error instanceof Error ? error.message : "Failed to save platform notice draft" });
  }
}

export async function patchAdminPlatformNotice(
  req: IncomingMessage,
  res: ServerResponse,
  context: BackendRequestContext,
  noticeId: string,
) {
  if (!requirePlatformContext(res, context)) return;
  const body = await readJsonBody(req);
  try {
    const result = await platformNoticeRepository.updatePlatformNoticeDraft(noticeId, {
      ...(body as object),
      senderName: context.userName,
      senderRole: context.userRole,
    });
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, 400, { message: error instanceof Error ? error.message : "Failed to update platform notice draft" });
  }
}

export async function publishAdminPlatformNoticeDraft(
  req: IncomingMessage,
  res: ServerResponse,
  context: BackendRequestContext,
  noticeId: string,
) {
  if (!requirePlatformContext(res, context)) return;
  const body = (await readJsonBody(req)) as { requestId?: string };
  try {
    const result = await platformNoticeRepository.publishPlatformNoticeDraft(noticeId, {
      requestId: body.requestId,
      actorName: context.userName,
      actorRole: context.userRole,
    });
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, 400, { message: error instanceof Error ? error.message : "Failed to publish platform notice draft" });
  }
}

export async function reeditAdminPlatformNoticeDraft(
  res: ServerResponse,
  context: BackendRequestContext,
  noticeId: string,
) {
  if (!requirePlatformContext(res, context)) return;
  try {
    const result = await platformNoticeRepository.createReeditDraftFromNotice(noticeId, {
      actorName: context.userName,
      actorRole: context.userRole,
    });
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, 400, { message: error instanceof Error ? error.message : "Failed to create reedit draft" });
  }
}

export async function revokeAdminPlatformNotice(
  req: IncomingMessage,
  res: ServerResponse,
  context: BackendRequestContext,
  noticeId: string,
) {
  if (!requirePlatformContext(res, context)) return;
  const body = (await readJsonBody(req)) as { reason?: string };
  try {
    const result = await platformNoticeRepository.revokePlatformNotice(noticeId, {
      reason: body.reason,
      actorName: context.userName,
      actorRole: context.userRole,
    });
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, 400, { message: error instanceof Error ? error.message : "Failed to revoke platform notice" });
  }
}

export async function deleteAdminPlatformNotice(
  res: ServerResponse,
  context: BackendRequestContext,
  noticeId: string,
) {
  if (!requirePlatformContext(res, context)) return;
  try {
    const result = await platformNoticeRepository.deletePlatformNotice(noticeId, {
      actorName: context.userName,
      actorRole: context.userRole,
    });
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, 400, { message: error instanceof Error ? error.message : "Failed to delete platform notice" });
  }
}

export async function getTenantPlatformNotices(url: URL, res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const result = await platformNoticeRepository.listTenantPlatformNoticeDeliveries(context.tenantId!, {
    page: Number(url.searchParams.get("page") ?? 1),
    pageSize: Number(url.searchParams.get("pageSize") ?? 20),
    keyword: url.searchParams.get("keyword") ?? undefined,
    level: url.searchParams.get("level") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    hasAttachments: url.searchParams.get("hasAttachments") === "true",
    state: (url.searchParams.get("state") as any) ?? "all",
    userName: context.userName,
  });
  sendJson(res, 200, result);
}

export async function getTenantPlatformNoticeDetail(
  res: ServerResponse,
  context: BackendRequestContext,
  noticeId: string,
) {
  if (!requireTenantContext(res, context)) return;
  try {
    const notice = await platformNoticeRepository.getTenantPlatformNoticeDetail(
      context.tenantId!,
      noticeId,
      context.userName,
    );
    sendJson(res, 200, { notice });
  } catch (error) {
    sendJson(res, 404, { message: error instanceof Error ? error.message : "Platform notice not found" });
  }
}

export async function patchTenantPlatformNoticeState(
  req: IncomingMessage,
  res: ServerResponse,
  context: BackendRequestContext,
  noticeId: string,
) {
  if (!requireTenantContext(res, context)) return;
  const body = (await readJsonBody(req)) as { action?: "read" | "archive" | "unarchive" };
  const action = body.action === "archive" || body.action === "unarchive" ? body.action : "read";
  try {
    const result = await platformNoticeRepository.updateTenantPlatformNoticeState(
      context.tenantId!,
      noticeId,
      context.userName,
      action,
    );
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, 400, { message: error instanceof Error ? error.message : "Failed to update notice state" });
  }
}
