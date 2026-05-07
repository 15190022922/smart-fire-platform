"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { ActionButton } from "@/components/ui/action-button";
import { AlertMessage } from "@/components/ui/alert-message";
import { Dialog } from "@/components/ui/dialog";
import { fieldClassName } from "@/components/ui/form-controls";
import type {
  PlatformNoticeDeliveryRecord,
  PlatformNoticeLevel,
  PlatformNoticeReadState,
} from "@/types/ops";

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

const stateLabels: Record<PlatformNoticeReadState, string> = {
  all: "全部",
  unread: "未读",
  read: "已读",
  archived: "已归档",
};

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function safeAttachments(notice: PlatformNoticeDeliveryRecord | null) {
  return Array.isArray(notice?.attachments) ? notice.attachments : [];
}

function buildQuery(params: {
  state: PlatformNoticeReadState;
  keyword: string;
  level: string;
  from: string;
  to: string;
  hasAttachments: boolean;
  page: number;
}) {
  const query = new URLSearchParams();
  query.set("state", params.state);
  query.set("page", String(params.page));
  query.set("pageSize", "20");
  if (params.keyword.trim()) query.set("keyword", params.keyword.trim());
  if (params.level) query.set("level", params.level);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.hasAttachments) query.set("hasAttachments", "true");
  return query.toString();
}

export function TenantPlatformNoticeBoard({ notices: initialNotices }: { notices: PlatformNoticeDeliveryRecord[] }) {
  const [notices, setNotices] = useState(initialNotices);
  const [selectedNotice, setSelectedNotice] = useState<PlatformNoticeDeliveryRecord | null>(null);
  const [state, setState] = useState<PlatformNoticeReadState>("all");
  const [keyword, setKeyword] = useState("");
  const [level, setLevel] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [hasAttachments, setHasAttachments] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(initialNotices.length);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const unreadCount = useMemo(() => notices.filter((notice) => !notice.readAt).length, [notices]);
  const selectedAttachments = safeAttachments(selectedNotice);

  async function fetchList(nextPage = page, overrides: Partial<{ state: PlatformNoticeReadState; hasAttachments: boolean }> = {}) {
    setLoading(true);
    setError("");
    const query = buildQuery({
      state: overrides.state ?? state,
      keyword,
      level,
      from,
      to,
      hasAttachments: overrides.hasAttachments ?? hasAttachments,
      page: nextPage,
    });
    const response = await fetch(`/api/tenant/platform-notices?${query}`, { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
      notices?: PlatformNoticeDeliveryRecord[];
      pagination?: { total?: number; page?: number };
    };
    setLoading(false);
    if (!response.ok) {
      setError(payload.message ?? "通知列表加载失败。");
      return;
    }
    setNotices(Array.isArray(payload.notices) ? payload.notices : []);
    setTotal(Number(payload.pagination?.total ?? 0));
    setPage(Number(payload.pagination?.page ?? nextPage));
  }

  async function openNotice(noticeId: string) {
    setError("");
    const response = await fetch(`/api/tenant/platform-notices/${encodeURIComponent(noticeId)}`, { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
      notice?: PlatformNoticeDeliveryRecord;
    };
    if (!response.ok || !payload.notice) {
      setError(payload.message ?? "通知详情加载失败。");
      return;
    }
    setSelectedNotice(payload.notice);
    await updateState(noticeId, "read", false);
  }

  async function updateState(noticeId: string, action: "read" | "archive" | "unarchive", closeAfter = true) {
    const response = await fetch(`/api/tenant/platform-notices/${encodeURIComponent(noticeId)}/state`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      setError(payload.message ?? "状态更新失败。");
      return;
    }
    if (closeAfter) setSelectedNotice(null);
    await fetchList(page);
  }

  return (
    <div className="space-y-2.5">
      <PageHeader
        title="平台通知"
        subtitle="查看平台下发的通知和附件。"
        aside={<StatusBadge status={`未读 ${unreadCount}`} tone={unreadCount > 0 ? "warning" : "neutral"} className="px-4 py-2 text-sm" />}
      />

      <SectionCard title="通知收件箱" description="点击通知查看完整正文和附件。">
        <div className="mb-3 grid gap-2 lg:grid-cols-[1fr_150px_140px_140px_auto]">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索标题或正文"
            className={fieldClassName}
          />
          <select value={level} onChange={(event) => setLevel(event.target.value)} className={fieldClassName}>
            <option value="">全部级别</option>
            <option value="info">普通通知</option>
            <option value="warning">重要提醒</option>
            <option value="critical">紧急通知</option>
          </select>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={fieldClassName} />
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className={fieldClassName} />
          <ActionButton onClick={() => void fetchList(1)} disabled={loading}>
            {loading ? "筛选中..." : "筛选"}
          </ActionButton>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          {(Object.keys(stateLabels) as PlatformNoticeReadState[]).map((item) => (
            <ActionButton
              key={item}
              size="xs"
              active={state === item}
              onClick={() => {
                setState(item);
                setPage(1);
                void fetchList(1, { state: item });
              }}
            >
              {stateLabels[item]}
            </ActionButton>
          ))}
          <label className="ml-auto inline-flex min-h-8 items-center gap-2 text-xs text-[color:var(--text-secondary)]">
            <input
              type="checkbox"
              checked={hasAttachments}
              onChange={(event) => {
                const checked = event.target.checked;
                setHasAttachments(checked);
                setPage(1);
                void fetchList(1, { hasAttachments: checked });
              }}
            />
            仅看有附件
          </label>
        </div>

        {error ? <AlertMessage tone="danger">{error}</AlertMessage> : null}

        <div className="space-y-3">
          {notices.length === 0 ? (
            <div className="sf-list-row px-4 py-6 text-center text-sm text-[color:var(--text-muted)]">
              暂无平台通知。
            </div>
          ) : null}
          {notices.map((notice) => {
            const noticeAttachments = safeAttachments(notice);
            return (
              <button
                key={notice.deliveryId}
                type="button"
                onClick={() => void openNotice(notice.id)}
                className="sf-list-row block w-full px-4 py-3.5 text-left transition hover:border-[color:var(--accent)] hover:bg-[var(--surface-muted)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {!notice.readAt ? <span className="h-2 w-2 rounded-full bg-[var(--warning-strong)]" aria-label="未读" /> : null}
                      <p className="text-sm font-semibold text-[color:var(--text-primary)]">{notice.title}</p>
                    </div>
                    <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                      {notice.createdAt} / {notice.senderName}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {notice.archivedAt ? <StatusBadge status="已归档" tone="neutral" /> : null}
                    {noticeAttachments.length > 0 ? <StatusBadge status={`附件 ${noticeAttachments.length}`} tone="info" /> : null}
                    <StatusBadge status={levelLabels[notice.level]} tone={levelTones[notice.level]} />
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-[color:var(--text-secondary)]">
                  {notice.content}
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[color:var(--text-muted)]">
          <span>共 {total} 条</span>
          <div className="flex gap-2">
            <ActionButton size="xs" disabled={page <= 1 || loading} onClick={() => void fetchList(page - 1)}>
              上一页
            </ActionButton>
            <ActionButton size="xs" disabled={page * 20 >= total || loading} onClick={() => void fetchList(page + 1)}>
              下一页
            </ActionButton>
          </div>
        </div>
      </SectionCard>

      <Dialog
        open={!!selectedNotice}
        onClose={() => setSelectedNotice(null)}
        title={selectedNotice?.title ?? "通知详情"}
        eyebrow="平台通知"
        description={
          selectedNotice
            ? `${selectedNotice.createdAt} / ${selectedNotice.senderName} / ${levelLabels[selectedNotice.level]}`
            : undefined
        }
        panelClassName="max-w-3xl"
      >
        {selectedNotice ? (
          <div className="space-y-4">
            <div className="rounded-[8px] border border-[color:var(--border-soft)] bg-[var(--surface-muted)] px-4 py-4">
              <p className="whitespace-pre-wrap text-sm leading-7 text-[color:var(--text-primary)]">
                {selectedNotice.content}
              </p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[color:var(--text-primary)]">附件</p>
                <StatusBadge status={`${selectedAttachments.length} 个文件`} tone={selectedAttachments.length > 0 ? "info" : "neutral"} />
              </div>
              {selectedAttachments.length > 0 ? (
                <div className="space-y-2">
                  {selectedAttachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={attachment.url}
                      download
                      className="sf-list-row flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                    >
                      <span className="min-w-0 truncate font-medium text-[color:var(--accent-strong)]">
                        {attachment.name}
                      </span>
                      <span className="shrink-0 text-xs text-[color:var(--text-muted)]">
                        {formatFileSize(attachment.size)} / 下载
                      </span>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="sf-list-row px-4 py-4 text-sm text-[color:var(--text-muted)]">
                  这条通知没有附件。
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              {selectedNotice.archivedAt ? (
                <ActionButton onClick={() => void updateState(selectedNotice.id, "unarchive")}>取消归档</ActionButton>
              ) : (
                <ActionButton onClick={() => void updateState(selectedNotice.id, "archive")}>归档</ActionButton>
              )}
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
