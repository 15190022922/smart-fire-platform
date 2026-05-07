"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { FeatureGuard } from "@/components/saas/feature-guard";
import { useSaaSDemo } from "@/components/saas/saas-demo-provider";
import { StatusBadge } from "@/components/status-badge";
import { ActionButton } from "@/components/ui/action-button";
import { AlertMessage } from "@/components/ui/alert-message";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { checkRowClassName, fieldClassName, textareaClassName } from "@/components/ui/form-controls";
import type {
  PlatformNoticeAttachment,
  PlatformNoticeLevel,
  PlatformNoticeRecord,
  PlatformNoticeStatus,
  PlatformNoticeTargetMode,
} from "@/types/ops";

type EditorMode = "new" | "draft" | "reedit";

const levelLabels: Record<PlatformNoticeLevel, string> = {
  info: "普通通知",
  warning: "重要提醒",
  critical: "紧急通知",
};

const levelTones: Record<PlatformNoticeLevel, "info" | "warning" | "danger"> = {
  info: "info",
  warning: "warning",
  critical: "danger",
};

const statusLabels: Record<PlatformNoticeStatus, string> = {
  draft: "草稿",
  sent: "已发送",
  revoked: "已撤回",
  deleted: "已删除",
};

const statusTones: Record<PlatformNoticeStatus, "success" | "neutral" | "danger" | "warning"> = {
  draft: "warning",
  sent: "success",
  revoked: "neutral",
  deleted: "danger",
};

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function createRequestId() {
  return `platform-notice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function PlatformNoticeManager({ initialNotices }: { initialNotices: PlatformNoticeRecord[] }) {
  const { tenants } = useSaaSDemo();
  const { confirmDialog } = useConfirmDialog();
  const [notices, setNotices] = useState(initialNotices);
  const [editingNoticeId, setEditingNoticeId] = useState("");
  const [editorMode, setEditorMode] = useState<EditorMode>("new");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [level, setLevel] = useState<PlatformNoticeLevel>("info");
  const [targetMode, setTargetMode] = useState<PlatformNoticeTargetMode>("all");
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<PlatformNoticeAttachment[]>([]);
  const [tenantSearch, setTenantSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedNotice, setSelectedNotice] = useState<PlatformNoticeRecord | null>(null);

  const editingNotice = useMemo(
    () => notices.find((notice) => notice.id === editingNoticeId) ?? null,
    [editingNoticeId, notices],
  );

  const filteredTenants = useMemo(() => {
    const keyword = tenantSearch.trim().toLowerCase();
    return tenants.filter((tenant) =>
      keyword ? [tenant.name, tenant.code, tenant.industry].join(" ").toLowerCase().includes(keyword) : true,
    );
  }, [tenantSearch, tenants]);

  function resetEditor() {
    setEditingNoticeId("");
    setEditorMode("new");
    setTitle("");
    setContent("");
    setLevel("info");
    setTargetMode("all");
    setSelectedTenantIds([]);
    setAttachments([]);
    setTenantSearch("");
  }

  function loadNoticeIntoEditor(notice: PlatformNoticeRecord, mode: EditorMode) {
    setEditingNoticeId(notice.id);
    setEditorMode(mode);
    setTitle(notice.title === "未命名草稿" ? "" : notice.title);
    setContent(notice.content);
    setLevel(notice.level);
    setTargetMode(notice.targetMode);
    setSelectedTenantIds(notice.targetMode === "selected" ? notice.targetTenantIds ?? [] : []);
    setAttachments(Array.isArray(notice.attachments) ? notice.attachments : []);
    setTenantSearch("");
    setSelectedNotice(null);
    setError("");
    setMessage(mode === "reedit" ? "已生成重新编辑草稿，修改后可重新发布。" : "");
  }

  function toggleTenant(tenantId: string) {
    setSelectedTenantIds((current) =>
      current.includes(tenantId) ? current.filter((id) => id !== tenantId) : [...current, tenantId],
    );
  }

  async function refresh() {
    const response = await fetch("/api/admin/platform-notices", { cache: "no-store" });
    if (!response.ok) return;
    const payload = (await response.json()) as { notices?: PlatformNoticeRecord[] };
    setNotices(Array.isArray(payload.notices) ? payload.notices : []);
  }

  function editorPayload() {
    return {
      title,
      content,
      level,
      targetMode,
      tenantIds: targetMode === "selected" ? selectedTenantIds : [],
      attachmentIds: attachments.map((attachment) => attachment.id),
    };
  }

  async function saveDraft(showSuccess = true) {
    setError("");
    setMessage("");
    if (uploading) {
      setError("附件仍在上传，请稍后再保存。");
      return null;
    }

    setSaving(true);
    const isExistingDraft = Boolean(editingNoticeId && editingNotice?.status === "draft");
    const response = await fetch(
      isExistingDraft ? `/api/admin/platform-notices/${encodeURIComponent(editingNoticeId)}` : "/api/admin/platform-notices/drafts",
      {
        method: isExistingDraft ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editorPayload(), requestId: createRequestId() }),
      },
    );
    const payload = (await response.json().catch(() => ({}))) as { message?: string; notice?: PlatformNoticeRecord };
    setSaving(false);

    if (!response.ok || !payload.notice) {
      setError(payload.message ?? "草稿保存失败。");
      return null;
    }

    setEditingNoticeId(payload.notice.id);
    setEditorMode(editorMode === "reedit" ? "reedit" : "draft");
    setAttachments(payload.notice.attachments ?? []);
    if (showSuccess) setMessage("草稿已保存。");
    await refresh();
    return payload.notice;
  }

  async function publishNotice() {
    setError("");
    setMessage("");

    if (!title.trim() || !content.trim()) {
      setError("请填写通知标题和正文。");
      return;
    }
    if (targetMode === "selected" && selectedTenantIds.length === 0) {
      setError("选择企业发送时，至少勾选一家企业。");
      return;
    }
    if (uploading) {
      setError("附件仍在上传，请稍后再发布。");
      return;
    }

    const confirmResult = await confirmDialog({
      title: editorMode === "reedit" ? "重新发布通知" : "发送平台通知",
      description:
        targetMode === "selected"
          ? `确认发送给 ${selectedTenantIds.length} 家企业吗？`
          : `确认发送给全部 ${tenants.length} 家企业吗？`,
      confirmLabel: editorMode === "reedit" ? "重新发布" : "发送",
    });
    if (confirmResult !== "confirm") return;

    setSaving(true);
    let response: Response;
    if (editingNoticeId && editingNotice?.status === "draft") {
      const savedDraft = await saveDraft(false);
      if (!savedDraft) {
        setSaving(false);
        return;
      }
      response = await fetch(`/api/admin/platform-notices/${encodeURIComponent(savedDraft.id)}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: createRequestId() }),
      });
    } else {
      response = await fetch("/api/admin/platform-notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editorPayload(), requestId: createRequestId() }),
      });
    }

    const payload = (await response.json().catch(() => ({}))) as { message?: string; notice?: PlatformNoticeRecord };
    setSaving(false);

    if (!response.ok || !payload.notice) {
      setError(payload.message ?? "平台通知发布失败。");
      return;
    }

    resetEditor();
    setMessage(`已发送给 ${payload.notice.targetTenantCount} 家企业。`);
    await refresh();
  }

  async function uploadAttachments(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    setMessage("");
    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/admin/platform-notice-files", {
          method: "POST",
          body: formData,
        });
        const payload = (await response.json().catch(() => ({}))) as {
          message?: string;
          attachment?: PlatformNoticeAttachment;
        };
        if (!response.ok || !payload.attachment) {
          throw new Error(payload.message ?? "附件上传失败。");
        }
        setAttachments((current) => [...current, payload.attachment!].slice(0, 10));
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "附件上传失败。");
    } finally {
      setUploading(false);
    }
  }

  async function revokeNotice(notice: PlatformNoticeRecord) {
    const result = await confirmDialog({
      title: "撤回通知",
      description: "撤回后企业端将不再看到这条通知。",
      confirmLabel: "确定撤回",
      extraLabel: "确定并重新编辑",
      tone: "warning",
    });
    if (result === "cancel") return;

    if (result === "extra") {
      const response = await fetch(`/api/admin/platform-notices/${encodeURIComponent(notice.id)}/reedit-draft`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string; notice?: PlatformNoticeRecord };
      if (!response.ok || !payload.notice) {
        setError(payload.message ?? "创建重新编辑草稿失败。");
        return;
      }
      await refresh();
      loadNoticeIntoEditor(payload.notice, "reedit");
      return;
    }

    const response = await fetch(`/api/admin/platform-notices/${encodeURIComponent(notice.id)}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      setError(payload.message ?? "撤回失败。");
      return;
    }
    setMessage("通知已撤回，企业端将不再可见。");
    await refresh();
  }

  async function deleteNotice(notice: PlatformNoticeRecord) {
    const result = await confirmDialog({
      title: notice.status === "draft" ? "删除草稿" : "删除发送历史",
      description:
        notice.status === "sent"
          ? "确认删除这条发送历史？未撤回的通知会先撤回，再从平台默认列表隐藏。"
          : "确认删除这条记录吗？",
      confirmLabel: "删除",
      tone: "danger",
    });
    if (result !== "confirm") return;

    const response = await fetch(`/api/admin/platform-notices/${encodeURIComponent(notice.id)}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      setError(payload.message ?? "删除失败。");
      return;
    }
    if (editingNoticeId === notice.id) resetEditor();
    setSelectedNotice(null);
    setMessage("通知已删除。");
    await refresh();
  }

  const editorTitle = editorMode === "new" ? "发布通知" : editorMode === "reedit" ? "重新编辑通知" : "编辑草稿";

  return (
    <FeatureGuard title="平台通知" permissionKey="platform.notices.manage">
      <div className="space-y-3 sm:space-y-4">
        <PageHeader
          title="平台通知"
          subtitle="向企业端发送平台级通知，支持先保存草稿再发布。"
          aside={<StatusBadge status={`企业 ${tenants.length}`} className="px-4 py-2 text-sm" />}
        />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <SectionCard
            title={editorTitle}
            description="草稿不会投递给企业，发布成功后企业端才可见。"
            extra={
              editingNoticeId ? (
                <ActionButton size="xs" onClick={resetEditor}>
                  新建通知
                </ActionButton>
              ) : null
            }
          >
            <div className="grid gap-4">
              <label className="space-y-2">
                <span className="text-sm text-[color:var(--text-secondary)]">标题</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} className={fieldClassName} />
              </label>

              <label className="space-y-2">
                <span className="text-sm text-[color:var(--text-secondary)]">正文</span>
                <textarea value={content} onChange={(event) => setContent(event.target.value)} className={textareaClassName} />
              </label>

              <label className="space-y-2">
                <span className="text-sm text-[color:var(--text-secondary)]">级别</span>
                <select
                  value={level}
                  onChange={(event) => setLevel(event.target.value as PlatformNoticeLevel)}
                  className={fieldClassName}
                >
                  <option value="info">普通通知</option>
                  <option value="warning">重要提醒</option>
                  <option value="critical">紧急通知</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm text-[color:var(--text-secondary)]">
                  附件 {uploading ? "上传中" : attachments.length > 0 ? "已上传" : ""}
                </span>
                <input
                  type="file"
                  multiple
                  onChange={(event) => {
                    void uploadAttachments(event.target.files);
                    event.currentTarget.value = "";
                  }}
                  className={fieldClassName}
                  disabled={uploading || attachments.length >= 10}
                />
              </label>

              {attachments.length > 0 ? (
                <div className="space-y-2 rounded-[8px] border border-[color:var(--border-soft)] bg-[var(--surface-muted)] p-3">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <a href={attachment.url} className="min-w-0 truncate font-medium text-[color:var(--accent-strong)]">
                        {attachment.name}
                      </a>
                      <div className="flex items-center gap-2 text-xs text-[color:var(--text-muted)]">
                        <span>{formatFileSize(attachment.size)}</span>
                        <button
                          type="button"
                          onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                          className="sf-button sf-button-secondary h-7 px-2 text-xs"
                        >
                          移除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-2">
                <label className={checkRowClassName}>
                  <input type="radio" checked={targetMode === "all"} onChange={() => setTargetMode("all")} />
                  <span className="text-sm text-[color:var(--text-primary)]">全部企业</span>
                </label>
                <label className={checkRowClassName}>
                  <input type="radio" checked={targetMode === "selected"} onChange={() => setTargetMode("selected")} />
                  <span className="text-sm text-[color:var(--text-primary)]">选择企业</span>
                </label>
              </div>

              {targetMode === "selected" ? (
                <div className="rounded-[8px] border border-[color:var(--border-soft)] bg-[var(--surface-muted)] p-3">
                  <input
                    value={tenantSearch}
                    onChange={(event) => setTenantSearch(event.target.value)}
                    placeholder="搜索企业名称、编码或行业"
                    className={fieldClassName}
                  />
                  <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                    {filteredTenants.map((tenant) => (
                      <label key={tenant.id} className={checkRowClassName}>
                        <input
                          type="checkbox"
                          checked={selectedTenantIds.includes(tenant.id)}
                          onChange={() => toggleTenant(tenant.id)}
                        />
                        <span className="min-w-0 text-sm text-[color:var(--text-primary)]">
                          {tenant.name}
                          <span className="ml-2 text-xs text-[color:var(--text-muted)]">{tenant.code}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              {error ? <AlertMessage tone="danger">{error}</AlertMessage> : null}
              {message ? <AlertMessage tone="success">{message}</AlertMessage> : null}

              <div className="flex flex-wrap justify-end gap-2">
                <ActionButton onClick={() => void saveDraft()} disabled={saving || uploading}>
                  {saving ? "保存中..." : "保存草稿"}
                </ActionButton>
                <ActionButton variant="primary" onClick={() => void publishNotice()} disabled={saving || uploading}>
                  {saving ? "发布中..." : editorMode === "reedit" ? "重新发布" : "发送通知"}
                </ActionButton>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="发送历史" description="可查看详情、编辑草稿、撤回或软删除。">
            <div className="space-y-3">
              {notices.length === 0 ? (
                <div className="sf-list-row px-4 py-6 text-center text-sm text-[color:var(--text-muted)]">
                  暂无平台通知。
                </div>
              ) : null}
              {notices.map((notice) => {
                const noticeAttachments = Array.isArray(notice.attachments) ? notice.attachments : [];
                return (
                  <div key={notice.id} className="sf-list-row px-4 py-3.5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button type="button" onClick={() => setSelectedNotice(notice)} className="min-w-0 text-left">
                        <p className="text-sm font-semibold text-[color:var(--text-primary)]">{notice.title}</p>
                        <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                          {notice.updatedAt ?? notice.createdAt} / {notice.senderName} / {notice.targetTenantCount} 家企业
                        </p>
                      </button>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <StatusBadge status={statusLabels[notice.status]} tone={statusTones[notice.status]} />
                        <StatusBadge status={levelLabels[notice.level]} tone={levelTones[notice.level]} />
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-[color:var(--text-secondary)]">{notice.content}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-[color:var(--text-muted)]">附件 {noticeAttachments.length}</span>
                      <div className="flex flex-wrap gap-2">
                        <ActionButton size="xs" onClick={() => setSelectedNotice(notice)}>
                          详情
                        </ActionButton>
                        {notice.status === "draft" ? (
                          <>
                            <ActionButton size="xs" variant="warning" onClick={() => loadNoticeIntoEditor(notice, "draft")}>
                              编辑
                            </ActionButton>
                            <ActionButton size="xs" variant="primary" onClick={() => loadNoticeIntoEditor(notice, "draft")}>
                              发布
                            </ActionButton>
                          </>
                        ) : null}
                        {notice.status === "sent" ? (
                          <ActionButton size="xs" variant="warning" onClick={() => void revokeNotice(notice)}>
                            撤回
                          </ActionButton>
                        ) : null}
                        <ActionButton size="xs" variant="danger" onClick={() => void deleteNotice(notice)}>
                          删除
                        </ActionButton>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>

        <Dialog
          open={!!selectedNotice}
          onClose={() => setSelectedNotice(null)}
          title={selectedNotice?.title ?? "通知详情"}
          eyebrow="平台通知"
          description={selectedNotice ? `${selectedNotice.updatedAt ?? selectedNotice.createdAt} / ${statusLabels[selectedNotice.status]}` : undefined}
          panelClassName="max-w-3xl"
        >
          {selectedNotice ? (
            <div className="space-y-4">
              <p className="whitespace-pre-wrap text-sm leading-7 text-[color:var(--text-primary)]">{selectedNotice.content}</p>
              <div className="space-y-2">
                {(selectedNotice.attachments ?? []).map((attachment) => (
                  <a
                    key={attachment.id}
                    href={attachment.url}
                    download
                    className="sf-list-row flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <span className="min-w-0 truncate font-medium text-[color:var(--accent-strong)]">{attachment.name}</span>
                    <span className="shrink-0 text-xs text-[color:var(--text-muted)]">{formatFileSize(attachment.size)}</span>
                  </a>
                ))}
                {(selectedNotice.attachments ?? []).length === 0 ? (
                  <div className="sf-list-row px-4 py-4 text-sm text-[color:var(--text-muted)]">这条通知没有附件。</div>
                ) : null}
              </div>
            </div>
          ) : null}
        </Dialog>
      </div>
    </FeatureGuard>
  );
}
