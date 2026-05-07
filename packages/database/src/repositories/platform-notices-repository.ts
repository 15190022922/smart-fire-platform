import type { DbExecutor } from "../client";
import { queryDb } from "../client";
import { assertTenantId, EntityNotFoundError } from "../errors";
import { withTransaction } from "../transaction";
import { insertAuditLog } from "./audit-repository";
import {
  createId,
  formatLocalTimestamp,
  mapPlatformNotice,
  mapPlatformNoticeDelivery,
  mapTenant,
  platformNoticeAttachments,
} from "./_shared";
import type {
  PlatformNoticeAttachment,
  PlatformNoticeReadState,
  PlatformNoticeRecord,
} from "../../../../types/ops";

const noticeLevels = new Set(["info", "warning", "critical"]);
const targetModes = new Set(["all", "selected"]);
const stateFilters = new Set(["all", "unread", "read", "archived"]);

type NoticePayloadInput = {
  title?: string;
  content?: string;
  level?: string;
  targetMode?: string;
  tenantIds?: string[];
  attachmentIds?: string[];
  attachments?: PlatformNoticeAttachment[];
  requestId?: string;
  senderName?: string | null;
  senderRole?: string | null;
};

type PlatformNoticeAuditInput = {
  actorName?: string | null;
  actorRole?: string | null;
};

type TenantPlatformNoticeFilters = {
  page?: number;
  pageSize?: number;
  keyword?: string;
  level?: string;
  from?: string;
  to?: string;
  hasAttachments?: boolean;
  state?: PlatformNoticeReadState;
  userName?: string | null;
};

type UploadedAttachmentInput = {
  id?: string;
  name: string;
  url: string;
  size: number;
  contentType: string;
  storageKey: string;
  uploadedByName?: string | null;
  uploadedByRole?: string | null;
};

function normalizeTenantIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean))];
}

function normalizeAttachmentIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean))].slice(0, 10);
}

function normalizeUserName(value?: string | null) {
  return String(value ?? "tenant_user").trim() || "tenant_user";
}

function normalizeNoticePayload(input: NoticePayloadInput, mode: "draft" | "publish") {
  const title = String(input.title ?? "").trim();
  const content = String(input.content ?? "").trim();
  const level = noticeLevels.has(String(input.level)) ? String(input.level) : "info";
  const targetMode = targetModes.has(String(input.targetMode)) ? String(input.targetMode) : "all";
  const tenantIds = normalizeTenantIds(input.tenantIds);
  const attachmentIds = normalizeAttachmentIds(input.attachmentIds);
  const legacyAttachments = platformNoticeAttachments(input.attachments).slice(0, 10);
  const requestId = String(input.requestId ?? "").trim();

  if (mode === "publish") {
    if (!title) {
      throw new Error("Platform notice title is required");
    }
    if (!content) {
      throw new Error("Platform notice content is required");
    }
    if (targetMode === "selected" && tenantIds.length === 0) {
      throw new Error("Selected platform notices require at least one tenant");
    }
  }

  return {
    title: title || "未命名草稿",
    content,
    level,
    targetMode,
    tenantIds,
    attachmentIds,
    legacyAttachments,
    requestId,
    senderName: String(input.senderName ?? "platform_admin").trim() || "platform_admin",
    senderRole: String(input.senderRole ?? "platform_super_admin").trim() || "platform_super_admin",
  };
}

function attachmentJsonSelect(alias = "notice") {
  return `COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', attachment.id,
          'name', attachment.original_name,
          'url', attachment.file_url,
          'size', attachment.file_size,
          'contentType', attachment.content_type,
          'noticeId', attachment.notice_id,
          'status', attachment.status,
          'createdAt', attachment.created_at,
          'boundAt', attachment.bound_at
        )
        ORDER BY attachment.created_at ASC, attachment.id ASC
      )
      FROM platform_notice_attachments AS attachment
      WHERE attachment.notice_id = ${alias}.id
        AND attachment.status <> 'deleted'
    ),
    ${alias}.attachments,
    '[]'::jsonb
  ) AS attachments`;
}

function mapAttachmentRow(row: any): PlatformNoticeAttachment {
  return {
    id: row.id,
    name: row.original_name,
    url: row.file_url,
    size: Number(row.file_size ?? 0),
    contentType: row.content_type,
    noticeId: row.notice_id ?? undefined,
    status: row.status ?? undefined,
    createdAt: row.created_at ?? undefined,
    boundAt: row.bound_at ?? undefined,
  };
}

async function listTargetTenants(executor: DbExecutor, targetMode: string, tenantIds: string[]) {
  const result =
    targetMode === "all"
      ? await executor.query("SELECT * FROM tenants ORDER BY created_at ASC")
      : await executor.query("SELECT * FROM tenants WHERE id = ANY($1::text[]) ORDER BY created_at ASC", [tenantIds]);
  const tenants = result.rows.map(mapTenant);

  if (targetMode === "selected" && tenants.length !== tenantIds.length) {
    const foundIds = new Set(tenants.map((tenant) => tenant.id));
    const missingId = tenantIds.find((tenantId) => !foundIds.has(tenantId)) ?? tenantIds[0];
    throw new EntityNotFoundError("tenant", missingId);
  }

  return tenants;
}

async function selectNoticeById(executor: DbExecutor, noticeId: string) {
  const result = await executor.query(
    `SELECT notice.*, ${attachmentJsonSelect("notice")}
     FROM platform_notices AS notice
     WHERE notice.id = $1
     LIMIT 1`,
    [noticeId],
  );
  return result.rows[0] ? mapPlatformNotice(result.rows[0]) : null;
}

async function selectNoticeByRequestId(executor: DbExecutor, requestId: string) {
  if (!requestId) return null;
  const result = await executor.query(
    `SELECT notice.*, ${attachmentJsonSelect("notice")}
     FROM platform_notices AS notice
     WHERE notice.request_id = $1
       AND notice.status <> 'deleted'
     LIMIT 1`,
    [requestId],
  );
  return result.rows[0] ? mapPlatformNotice(result.rows[0]) : null;
}

async function listDeliveriesForNotice(executor: DbExecutor, noticeId: string) {
  const result = await executor.query(
    "SELECT tenant_id, tenant_name FROM platform_notice_deliveries WHERE notice_id = $1 ORDER BY created_at ASC",
    [noticeId],
  );
  return result.rows.map((row) => ({
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
  }));
}

async function auditPlatformNotice(
  executor: DbExecutor,
  action: string,
  noticeId: string,
  audit: PlatformNoticeAuditInput,
  detail: string,
  createdAt: string,
) {
  await insertAuditLog(executor, {
    id: createId("audit"),
    actorScope: "platform",
    actorName: audit.actorName ?? "platform_admin",
    actorRole: audit.actorRole ?? "platform_super_admin",
    action,
    targetType: "platform_notice",
    targetId: noticeId,
    result: "success",
    detail,
    createdAt,
  });
}

async function bindUploadedAttachments(
  executor: DbExecutor,
  noticeId: string,
  attachmentIds: string[],
  now: string,
) {
  if (attachmentIds.length === 0) return [];

  const result = await executor.query(
    `SELECT *
     FROM platform_notice_attachments
     WHERE id = ANY($1::text[])
       AND status <> 'deleted'
     FOR UPDATE`,
    [attachmentIds],
  );

  if (result.rows.length !== attachmentIds.length) {
    throw new Error("Some notice attachments are missing or expired");
  }

  for (const row of result.rows) {
    if (row.notice_id && row.notice_id !== noticeId) {
      throw new Error("Some notice attachments have already been used");
    }
  }

  await executor.query(
    `UPDATE platform_notice_attachments
     SET notice_id = $2,
         status = 'bound',
         bound_at = COALESCE(bound_at, $3)
     WHERE id = ANY($1::text[])`,
    [attachmentIds, noticeId, now],
  );

  const byId = new Map(
    result.rows.map((row) => [row.id, { ...row, notice_id: noticeId, status: "bound", bound_at: row.bound_at ?? now }]),
  );
  return attachmentIds.map((id) => mapAttachmentRow(byId.get(id) ?? result.rows[0]));
}

async function bindLegacyAttachments(
  executor: DbExecutor,
  noticeId: string,
  attachments: PlatformNoticeAttachment[],
  audit: PlatformNoticeAuditInput,
  now: string,
) {
  const rows = [];
  for (const attachment of attachments) {
    const storageKey = attachment.url.replace(/^\/api\/platform-notice-files\//, "");
    const result = await executor.query(
      `INSERT INTO platform_notice_attachments (
         id, notice_id, original_name, file_url, file_size, content_type, storage_key,
         status, uploaded_by_name, uploaded_by_role, created_at, bound_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,'bound',$8,$9,$10,$10)
       ON CONFLICT (id) DO UPDATE
         SET notice_id = EXCLUDED.notice_id,
             original_name = EXCLUDED.original_name,
             file_url = EXCLUDED.file_url,
             file_size = EXCLUDED.file_size,
             content_type = EXCLUDED.content_type,
             storage_key = EXCLUDED.storage_key,
             status = 'bound',
             bound_at = COALESCE(platform_notice_attachments.bound_at, EXCLUDED.bound_at)
       RETURNING *`,
      [
        attachment.id,
        noticeId,
        attachment.name,
        attachment.url,
        Math.max(0, Math.round(Number(attachment.size ?? 0))),
        attachment.contentType || "application/octet-stream",
        storageKey || attachment.id,
        audit.actorName ?? "platform_admin",
        audit.actorRole ?? "platform_super_admin",
        now,
      ],
    );
    rows.push(result.rows[0]);
  }
  return rows.map(mapAttachmentRow);
}

async function detachRemovedDraftAttachments(
  executor: DbExecutor,
  noticeId: string,
  keepAttachmentIds: string[],
) {
  await executor.query(
    `UPDATE platform_notice_attachments
     SET notice_id = NULL,
         status = 'uploaded',
         bound_at = NULL
     WHERE notice_id = $1
       AND NOT (id = ANY($2::text[]))`,
    [noticeId, keepAttachmentIds],
  );
}

async function updateNoticeAttachmentSnapshot(
  executor: DbExecutor,
  noticeId: string,
  attachments: PlatformNoticeAttachment[],
) {
  await executor.query("UPDATE platform_notices SET attachments = $2::jsonb WHERE id = $1", [
    noticeId,
    JSON.stringify(attachments),
  ]);
}

async function resolveNoticeAttachments(executor: DbExecutor, noticeId: string) {
  const result = await executor.query(
    "SELECT * FROM platform_notice_attachments WHERE notice_id = $1 AND status <> 'deleted' ORDER BY created_at ASC, id ASC",
    [noticeId],
  );
  return result.rows.map(mapAttachmentRow);
}

async function setDraftAttachments(
  executor: DbExecutor,
  noticeId: string,
  attachmentIds: string[],
  legacyAttachments: PlatformNoticeAttachment[],
  audit: PlatformNoticeAuditInput,
  now: string,
) {
  if (attachmentIds.length > 0) {
    await detachRemovedDraftAttachments(executor, noticeId, attachmentIds);
    const attachments = await bindUploadedAttachments(executor, noticeId, attachmentIds, now);
    await updateNoticeAttachmentSnapshot(executor, noticeId, attachments);
    return attachments;
  }

  if (legacyAttachments.length > 0) {
    await detachRemovedDraftAttachments(
      executor,
      noticeId,
      legacyAttachments.map((attachment) => attachment.id),
    );
    const attachments = await bindLegacyAttachments(executor, noticeId, legacyAttachments, audit, now);
    await updateNoticeAttachmentSnapshot(executor, noticeId, attachments);
    return attachments;
  }

  await detachRemovedDraftAttachments(executor, noticeId, []);
  await updateNoticeAttachmentSnapshot(executor, noticeId, []);
  return [];
}

async function createDeliveriesForNotice(
  executor: DbExecutor,
  noticeId: string,
  targetMode: string,
  tenantIds: string[],
  now: string,
) {
  const tenants = await listTargetTenants(executor, targetMode, tenantIds);
  for (const tenant of tenants) {
    await executor.query(
      `INSERT INTO platform_notice_deliveries (id, notice_id, tenant_id, tenant_name, status, created_at)
       VALUES ($1,$2,$3,$4,'delivered',$5)
       ON CONFLICT (notice_id, tenant_id) DO UPDATE
         SET status = 'delivered',
             tenant_name = EXCLUDED.tenant_name`,
      [createId("platform-notice-delivery"), noticeId, tenant.id, tenant.name, now],
    );
  }
  return tenants;
}

async function cloneAttachmentsForDraft(
  executor: DbExecutor,
  sourceNoticeId: string,
  draftNoticeId: string,
  audit: PlatformNoticeAuditInput,
  now: string,
) {
  const result = await executor.query(
    `SELECT *
     FROM platform_notice_attachments
     WHERE notice_id = $1
       AND status <> 'deleted'
     ORDER BY created_at ASC, id ASC`,
    [sourceNoticeId],
  );

  const attachments = [];
  for (const row of result.rows) {
    const cloneId = createId("platform-notice-attachment");
    const inserted = await executor.query(
      `INSERT INTO platform_notice_attachments (
         id, notice_id, original_name, file_url, file_size, content_type, storage_key,
         status, uploaded_by_name, uploaded_by_role, created_at, bound_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,'bound',$8,$9,$10,$10)
       RETURNING *`,
      [
        cloneId,
        draftNoticeId,
        row.original_name,
        row.file_url,
        Number(row.file_size ?? 0),
        row.content_type,
        row.storage_key,
        audit.actorName ?? "platform_admin",
        audit.actorRole ?? "platform_super_admin",
        now,
      ],
    );
    attachments.push(mapAttachmentRow(inserted.rows[0]));
  }
  await updateNoticeAttachmentSnapshot(executor, draftNoticeId, attachments);
  return attachments;
}

export async function createUploadedPlatformNoticeAttachment(input: UploadedAttachmentInput) {
  const now = formatLocalTimestamp();
  const id = input.id ?? createId("platform-notice-attachment");
  const result = await queryDb(
    `INSERT INTO platform_notice_attachments (
       id, original_name, file_url, file_size, content_type, storage_key,
       status, uploaded_by_name, uploaded_by_role, created_at
     )
     VALUES ($1,$2,$3,$4,$5,$6,'uploaded',$7,$8,$9)
     RETURNING *`,
    [
      id,
      input.name,
      input.url,
      Math.max(0, Math.round(Number(input.size ?? 0))),
      input.contentType || "application/octet-stream",
      input.storageKey,
      input.uploadedByName ?? "platform_admin",
      input.uploadedByRole ?? "platform_super_admin",
      now,
    ],
  );
  return mapAttachmentRow(result.rows[0]);
}

export async function listPlatformNotices() {
  const result = await queryDb(
    `SELECT notice.*, ${attachmentJsonSelect("notice")}
     FROM platform_notices AS notice
     WHERE notice.status <> 'deleted'
     ORDER BY COALESCE(notice.updated_at, notice.created_at) DESC, notice.id DESC
     LIMIT 300`,
  );
  return result.rows.map(mapPlatformNotice);
}

export async function createPlatformNoticeDraft(input: NoticePayloadInput) {
  const normalized = normalizeNoticePayload(input, "draft");
  return withTransaction(async (client) => {
    const now = formatLocalTimestamp();
    const noticeId = createId("platform-notice");
    await client.query(
      `INSERT INTO platform_notices (
         id, title, content, level, target_mode, status, sender_name, sender_role,
         target_tenant_count, target_tenant_ids, attachments, request_id, created_at, updated_at
       )
       VALUES ($1,$2,$3,$4,$5,'draft',$6,$7,0,$8::jsonb,'[]'::jsonb,$9,$10,$10)`,
      [
        noticeId,
        normalized.title,
        normalized.content,
        normalized.level,
        normalized.targetMode,
        normalized.senderName,
        normalized.senderRole,
        JSON.stringify(normalized.targetMode === "selected" ? normalized.tenantIds : []),
        normalized.requestId || null,
        now,
      ],
    );
    await setDraftAttachments(
      client,
      noticeId,
      normalized.attachmentIds,
      normalized.legacyAttachments,
      { actorName: normalized.senderName, actorRole: normalized.senderRole },
      now,
    );
    await auditPlatformNotice(
      client,
      "platform_notice.draft.save",
      noticeId,
      { actorName: normalized.senderName, actorRole: normalized.senderRole },
      "Saved platform notice draft",
      now,
    );
    return { notice: (await selectNoticeById(client, noticeId)) as PlatformNoticeRecord };
  });
}

export async function updatePlatformNoticeDraft(noticeId: string, input: NoticePayloadInput) {
  const normalized = normalizeNoticePayload(input, "draft");
  return withTransaction(async (client) => {
    const notice = await selectNoticeById(client, noticeId);
    if (!notice || notice.status === "deleted") {
      throw new EntityNotFoundError("platform_notice", noticeId);
    }
    if (notice.status !== "draft") {
      throw new Error("Only draft platform notices can be updated");
    }
    const now = formatLocalTimestamp();
    await client.query(
      `UPDATE platform_notices
       SET title = $2,
           content = $3,
           level = $4,
           target_mode = $5,
           target_tenant_ids = $6::jsonb,
           updated_at = $7
       WHERE id = $1`,
      [
        noticeId,
        normalized.title,
        normalized.content,
        normalized.level,
        normalized.targetMode,
        JSON.stringify(normalized.targetMode === "selected" ? normalized.tenantIds : []),
        now,
      ],
    );
    await setDraftAttachments(
      client,
      noticeId,
      normalized.attachmentIds,
      normalized.legacyAttachments,
      { actorName: normalized.senderName, actorRole: normalized.senderRole },
      now,
    );
    await auditPlatformNotice(
      client,
      "platform_notice.draft.update",
      noticeId,
      { actorName: normalized.senderName, actorRole: normalized.senderRole },
      "Updated platform notice draft",
      now,
    );
    return { notice: (await selectNoticeById(client, noticeId)) as PlatformNoticeRecord };
  });
}

export async function publishPlatformNoticeDraft(
  noticeId: string,
  input: PlatformNoticeAuditInput & { requestId?: string },
) {
  return withTransaction(async (client) => {
    const notice = await selectNoticeById(client, noticeId);
    if (!notice || notice.status === "deleted") {
      throw new EntityNotFoundError("platform_notice", noticeId);
    }
    if (notice.status !== "draft") {
      throw new Error("Only draft platform notices can be published");
    }
    normalizeNoticePayload(
      {
        title: notice.title,
        content: notice.content,
        level: notice.level,
        targetMode: notice.targetMode,
        tenantIds: notice.targetTenantIds,
      },
      "publish",
    );
    const now = formatLocalTimestamp();
    const tenants = await createDeliveriesForNotice(client, noticeId, notice.targetMode, notice.targetTenantIds, now);
    const attachments = await resolveNoticeAttachments(client, noticeId);
    await updateNoticeAttachmentSnapshot(client, noticeId, attachments);
    await client.query(
      `UPDATE platform_notices
       SET status = 'sent',
           target_tenant_count = $2,
           request_id = COALESCE(NULLIF($3, ''), request_id),
           updated_at = $4,
           published_at = $4
       WHERE id = $1`,
      [noticeId, tenants.length, input.requestId ?? "", now],
    );
    await auditPlatformNotice(
      client,
      "platform_notice.publish",
      noticeId,
      input,
      `Published platform notice to ${tenants.length} tenant(s)`,
      now,
    );
    return {
      notice: (await selectNoticeById(client, noticeId)) as PlatformNoticeRecord,
      deliveries: tenants.map((tenant) => ({ tenantId: tenant.id, tenantName: tenant.name })),
    };
  });
}

export async function createPlatformNotice(input: NoticePayloadInput) {
  const normalized = normalizeNoticePayload(input, "publish");
  return withTransaction(async (client) => {
    const existing = await selectNoticeByRequestId(client, normalized.requestId);
    if (existing) {
      return {
        notice: existing,
        deliveries: await listDeliveriesForNotice(client, existing.id),
        idempotent: true,
      };
    }

    const tenants = await listTargetTenants(client, normalized.targetMode, normalized.tenantIds);
    const now = formatLocalTimestamp();
    const noticeId = createId("platform-notice");

    await client.query(
      `INSERT INTO platform_notices (
         id, title, content, level, target_mode, status, sender_name, sender_role,
         target_tenant_count, target_tenant_ids, attachments, request_id, created_at, updated_at, published_at
       )
       VALUES ($1,$2,$3,$4,$5,'sent',$6,$7,$8,$9::jsonb,'[]'::jsonb,$10,$11,$11,$11)`,
      [
        noticeId,
        normalized.title,
        normalized.content,
        normalized.level,
        normalized.targetMode,
        normalized.senderName,
        normalized.senderRole,
        tenants.length,
        JSON.stringify(normalized.targetMode === "selected" ? normalized.tenantIds : []),
        normalized.requestId || null,
        now,
      ],
    );

    const attachments =
      normalized.attachmentIds.length > 0
        ? await bindUploadedAttachments(client, noticeId, normalized.attachmentIds, now)
        : await bindLegacyAttachments(
            client,
            noticeId,
            normalized.legacyAttachments,
            { actorName: normalized.senderName, actorRole: normalized.senderRole },
            now,
          );
    await updateNoticeAttachmentSnapshot(client, noticeId, attachments);

    for (const tenant of tenants) {
      await client.query(
        `INSERT INTO platform_notice_deliveries (id, notice_id, tenant_id, tenant_name, status, created_at)
         VALUES ($1,$2,$3,$4,'delivered',$5)
         ON CONFLICT (notice_id, tenant_id) DO NOTHING`,
        [createId("platform-notice-delivery"), noticeId, tenant.id, tenant.name, now],
      );
    }

    await auditPlatformNotice(
      client,
      "platform_notice.publish",
      noticeId,
      { actorName: normalized.senderName, actorRole: normalized.senderRole },
      `Published platform notice to ${tenants.length} tenant(s)`,
      now,
    );

    return {
      notice: (await selectNoticeById(client, noticeId)) as PlatformNoticeRecord,
      deliveries: tenants.map((tenant) => ({
        tenantId: tenant.id,
        tenantName: tenant.name,
      })),
    };
  });
}

export async function revokePlatformNotice(
  noticeId: string,
  input: PlatformNoticeAuditInput & { reason?: string | null },
) {
  return withTransaction(async (client) => {
    const notice = await selectNoticeById(client, noticeId);
    if (!notice || notice.status === "deleted") {
      throw new EntityNotFoundError("platform_notice", noticeId);
    }
    if (notice.status === "revoked") {
      return { notice };
    }
    if (notice.status === "draft") {
      throw new Error("Draft platform notices cannot be revoked");
    }

    const now = formatLocalTimestamp();
    await client.query(
      `UPDATE platform_notices
       SET status = 'revoked',
           revoked_at = COALESCE(revoked_at, $2),
           revoke_reason = $3,
           updated_at = $2
       WHERE id = $1`,
      [noticeId, now, String(input.reason ?? "").trim() || null],
    );
    await client.query("UPDATE platform_notice_deliveries SET status = 'revoked' WHERE notice_id = $1", [noticeId]);
    await auditPlatformNotice(
      client,
      "platform_notice.revoke",
      noticeId,
      input,
      input.reason ? `Revoked platform notice: ${input.reason}` : "Revoked platform notice",
      now,
    );
    return { notice: (await selectNoticeById(client, noticeId)) as PlatformNoticeRecord };
  });
}

export async function createReeditDraftFromNotice(noticeId: string, input: PlatformNoticeAuditInput) {
  return withTransaction(async (client) => {
    const notice = await selectNoticeById(client, noticeId);
    if (!notice || notice.status === "deleted") {
      throw new EntityNotFoundError("platform_notice", noticeId);
    }
    if (notice.status === "draft") {
      return { notice };
    }

    const now = formatLocalTimestamp();
    if (notice.status === "sent") {
      await client.query(
        `UPDATE platform_notices
         SET status = 'revoked',
             revoked_at = COALESCE(revoked_at, $2),
             revoke_reason = COALESCE(revoke_reason, 'Reediting platform notice'),
             updated_at = $2
         WHERE id = $1`,
        [noticeId, now],
      );
      await client.query("UPDATE platform_notice_deliveries SET status = 'revoked' WHERE notice_id = $1", [noticeId]);
      await auditPlatformNotice(
        client,
        "platform_notice.revoke",
        noticeId,
        input,
        "Revoked platform notice for reediting",
        now,
      );
    }

    const deliveredTenantIds = (await listDeliveriesForNotice(client, noticeId)).map((delivery) => delivery.tenantId);
    const targetTenantIds =
      notice.targetMode === "selected"
        ? notice.targetTenantIds.length > 0
          ? notice.targetTenantIds
          : deliveredTenantIds
        : [];
    const draftId = createId("platform-notice");
    await client.query(
      `INSERT INTO platform_notices (
         id, title, content, level, target_mode, status, sender_name, sender_role,
         target_tenant_count, target_tenant_ids, attachments, created_at, updated_at
       )
       VALUES ($1,$2,$3,$4,$5,'draft',$6,$7,0,$8::jsonb,'[]'::jsonb,$9,$9)`,
      [
        draftId,
        notice.title,
        notice.content,
        notice.level,
        notice.targetMode,
        input.actorName ?? "platform_admin",
        input.actorRole ?? "platform_super_admin",
        JSON.stringify(targetTenantIds),
        now,
      ],
    );
    await cloneAttachmentsForDraft(client, noticeId, draftId, input, now);
    await auditPlatformNotice(
      client,
      "platform_notice.draft.reedit",
      draftId,
      input,
      `Created reedit draft from ${noticeId}`,
      now,
    );
    return { notice: (await selectNoticeById(client, draftId)) as PlatformNoticeRecord };
  });
}

export async function deletePlatformNotice(noticeId: string, input: PlatformNoticeAuditInput) {
  return withTransaction(async (client) => {
    const notice = await selectNoticeById(client, noticeId);
    if (!notice) {
      throw new EntityNotFoundError("platform_notice", noticeId);
    }
    if (notice.status === "deleted") {
      return { notice };
    }

    const now = formatLocalTimestamp();
    await client.query(
      `UPDATE platform_notices
       SET status = 'deleted',
           revoked_at = CASE WHEN status = 'sent' THEN COALESCE(revoked_at, $2) ELSE revoked_at END,
           deleted_at = COALESCE(deleted_at, $2),
           revoke_reason = CASE WHEN status = 'sent' THEN COALESCE(revoke_reason, 'Deleted by platform admin') ELSE revoke_reason END,
           updated_at = $2
       WHERE id = $1`,
      [noticeId, now],
    );
    await client.query("UPDATE platform_notice_deliveries SET status = 'revoked' WHERE notice_id = $1", [noticeId]);
    await auditPlatformNotice(client, "platform_notice.delete", noticeId, input, "Soft deleted platform notice", now);
    return { notice: (await selectNoticeById(client, noticeId)) as PlatformNoticeRecord };
  });
}

export async function listTenantPlatformNoticeDeliveries(tenantId: string, filters: TenantPlatformNoticeFilters = {}) {
  assertTenantId(tenantId);
  const userName = normalizeUserName(filters.userName);
  const pageSize = Math.min(Math.max(Number(filters.pageSize ?? 20), 1), 100);
  const page = Math.max(Number(filters.page ?? 1), 1);
  const state = stateFilters.has(String(filters.state)) ? filters.state ?? "all" : "all";
  const params: unknown[] = [tenantId, userName];
  const where = [
    "delivery.tenant_id = $1",
    "delivery.status = 'delivered'",
    "notice.status = 'sent'",
    "notice.deleted_at IS NULL",
  ];

  if (filters.keyword?.trim()) {
    params.push(`%${filters.keyword.trim()}%`);
    where.push(`(notice.title ILIKE $${params.length} OR notice.content ILIKE $${params.length})`);
  }
  if (noticeLevels.has(String(filters.level))) {
    params.push(filters.level);
    where.push(`notice.level = $${params.length}`);
  }
  if (filters.from?.trim()) {
    params.push(filters.from.trim());
    where.push(`notice.created_at >= $${params.length}`);
  }
  if (filters.to?.trim()) {
    params.push(filters.to.trim());
    where.push(`notice.created_at <= $${params.length}`);
  }
  if (filters.hasAttachments) {
    where.push(
      `(EXISTS (
        SELECT 1 FROM platform_notice_attachments attachment
        WHERE attachment.notice_id = notice.id AND attachment.status <> 'deleted'
      ) OR jsonb_array_length(notice.attachments) > 0)`,
    );
  }

  if (state === "archived") {
    where.push("state.archived_at IS NOT NULL");
  } else {
    where.push("state.archived_at IS NULL");
    if (state === "unread") {
      where.push("state.read_at IS NULL");
    }
    if (state === "read") {
      where.push("state.read_at IS NOT NULL");
    }
  }

  const whereSql = where.join(" AND ");
  const offset = (page - 1) * pageSize;
  const totalResult = await queryDb(
    `SELECT COUNT(*)::int AS count
     FROM platform_notice_deliveries AS delivery
     INNER JOIN platform_notices AS notice ON notice.id = delivery.notice_id
     LEFT JOIN platform_notice_user_states AS state
       ON state.notice_id = notice.id
      AND state.tenant_id = delivery.tenant_id
      AND state.user_name = $2
     WHERE ${whereSql}`,
    params,
  );

  params.push(pageSize, offset);
  const result = await queryDb(
    `SELECT
       notice.id,
       notice.title,
       notice.content,
       notice.level,
       notice.target_mode,
       notice.status,
       notice.sender_name,
       notice.sender_role,
       notice.target_tenant_count,
       notice.target_tenant_ids,
       ${attachmentJsonSelect("notice")},
       notice.created_at,
       notice.updated_at,
       notice.published_at,
       notice.revoked_at,
       notice.deleted_at,
       notice.revoke_reason,
       notice.request_id,
       delivery.id AS delivery_id,
       delivery.tenant_id,
       delivery.tenant_name,
       delivery.created_at AS delivered_at,
       state.read_at,
       state.archived_at
     FROM platform_notice_deliveries AS delivery
     INNER JOIN platform_notices AS notice ON notice.id = delivery.notice_id
     LEFT JOIN platform_notice_user_states AS state
       ON state.notice_id = notice.id
      AND state.tenant_id = delivery.tenant_id
      AND state.user_name = $2
     WHERE ${whereSql}
     ORDER BY notice.created_at DESC, delivery.id DESC
     LIMIT $${params.length - 1}
     OFFSET $${params.length}`,
    params,
  );

  return {
    notices: result.rows.map(mapPlatformNoticeDelivery),
    pagination: {
      page,
      pageSize,
      total: Number(totalResult.rows[0]?.count ?? 0),
    },
  };
}

export async function getTenantPlatformNoticeDetail(tenantId: string, noticeId: string, userName?: string | null) {
  assertTenantId(tenantId);
  const result = await queryDb(
    `SELECT
       notice.*,
       ${attachmentJsonSelect("notice")},
       delivery.id AS delivery_id,
       delivery.tenant_id,
       delivery.tenant_name,
       delivery.created_at AS delivered_at,
       state.read_at,
       state.archived_at
     FROM platform_notice_deliveries AS delivery
     INNER JOIN platform_notices AS notice ON notice.id = delivery.notice_id
     LEFT JOIN platform_notice_user_states AS state
       ON state.notice_id = notice.id
      AND state.tenant_id = delivery.tenant_id
      AND state.user_name = $3
     WHERE delivery.tenant_id = $1
       AND notice.id = $2
       AND delivery.status = 'delivered'
       AND notice.status = 'sent'
       AND notice.deleted_at IS NULL
     LIMIT 1`,
    [tenantId, noticeId, normalizeUserName(userName)],
  );
  if (!result.rows[0]) {
    throw new EntityNotFoundError("platform_notice", noticeId);
  }
  return mapPlatformNoticeDelivery(result.rows[0]);
}

export async function updateTenantPlatformNoticeState(
  tenantId: string,
  noticeId: string,
  userName: string | null | undefined,
  action: "read" | "archive" | "unarchive",
) {
  assertTenantId(tenantId);
  const normalizedUserName = normalizeUserName(userName);
  return withTransaction(async (client) => {
    await getTenantPlatformNoticeDetail(tenantId, noticeId, normalizedUserName);
    const now = formatLocalTimestamp();
    if (action === "read") {
      await client.query(
        `INSERT INTO platform_notice_user_states (notice_id, tenant_id, user_name, read_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$4,$4)
         ON CONFLICT (notice_id, tenant_id, user_name) DO UPDATE
           SET read_at = COALESCE(platform_notice_user_states.read_at, EXCLUDED.read_at),
               updated_at = EXCLUDED.updated_at`,
        [noticeId, tenantId, normalizedUserName, now],
      );
    } else if (action === "archive") {
      await client.query(
        `INSERT INTO platform_notice_user_states (notice_id, tenant_id, user_name, read_at, archived_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$4,$4,$4)
         ON CONFLICT (notice_id, tenant_id, user_name) DO UPDATE
           SET read_at = COALESCE(platform_notice_user_states.read_at, EXCLUDED.read_at),
               archived_at = EXCLUDED.archived_at,
               updated_at = EXCLUDED.updated_at`,
        [noticeId, tenantId, normalizedUserName, now],
      );
    } else {
      await client.query(
        `INSERT INTO platform_notice_user_states (notice_id, tenant_id, user_name, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$4)
         ON CONFLICT (notice_id, tenant_id, user_name) DO UPDATE
           SET archived_at = NULL,
               updated_at = EXCLUDED.updated_at`,
        [noticeId, tenantId, normalizedUserName, now],
      );
    }
    const notice = await getTenantPlatformNoticeDetail(tenantId, noticeId, normalizedUserName);
    return { notice };
  });
}
