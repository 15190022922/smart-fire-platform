"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { getTenantEventBus } from "@/lib/realtime/event-bus";
import type { NotificationRecord, NotificationTemplateRecord } from "@/types/ops";

const TEMPLATE_PAGE_SIZE = 6;
const RECORD_PAGE_SIZE = 8;

export function NotificationCenterBoard({
  initialTemplates,
  initialRecords,
}: {
  initialTemplates: NotificationTemplateRecord[];
  initialRecords: NotificationRecord[];
}) {
  const safeInitialRecords = Array.isArray(initialRecords) ? initialRecords : [];
  const safeInitialTemplates = Array.isArray(initialTemplates) ? initialTemplates : [];
  const [templates, setTemplates] = useState(safeInitialTemplates);
  const [records, setRecords] = useState(safeInitialRecords);
  const [errorMessage, setErrorMessage] = useState("");
  const [templatePage, setTemplatePage] = useState(1);
  const [recordPage, setRecordPage] = useState(1);

  const templateCount = templates.length;
  const templateTotalPages = Math.max(1, Math.ceil(templateCount / TEMPLATE_PAGE_SIZE));
  const recordTotalPages = Math.max(1, Math.ceil(records.length / RECORD_PAGE_SIZE));
  const safeTemplatePage = Math.min(templatePage, templateTotalPages);
  const safeRecordPage = Math.min(recordPage, recordTotalPages);

  const visibleTemplates = useMemo(() => {
    const start = (safeTemplatePage - 1) * TEMPLATE_PAGE_SIZE;
    return templates.slice(start, start + TEMPLATE_PAGE_SIZE);
  }, [safeTemplatePage, templates]);

  const visibleRecords = useMemo(() => {
    const start = (safeRecordPage - 1) * RECORD_PAGE_SIZE;
    return records.slice(start, start + RECORD_PAGE_SIZE);
  }, [records, safeRecordPage]);

  const refresh = useCallback(async () => {
    const refreshed = await fetch("/api/tenant/notification-center", { cache: "no-store" });
    if (!refreshed.ok) return;
    const data = (await refreshed.json()) as {
      templates?: NotificationTemplateRecord[];
      records?: NotificationRecord[];
    };
    setTemplates(Array.isArray(data.templates) ? data.templates : []);
    setRecords(Array.isArray(data.records) ? data.records : []);
  }, []);

  useEffect(() => {
    const bus = getTenantEventBus();
    return bus.subscribe({
      types: ["alarm_created", "alarm_updated", "device_status_changed", "system_alert"],
      onEvent: () => {
        void refresh();
      },
    });
  }, [refresh]);

  async function retryRecord(recordId: string) {
    setErrorMessage("");
    const response = await fetch("/api/tenant/notification-center", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordId }),
    });

    if (!response.ok) {
      setErrorMessage("通知重试失败");
      return;
    }

    await refresh();
  }

  return (
    <div className="space-y-2.5">
      <PageHeader
        title="通知中心"
        subtitle="统一管理短信和站内通知模板、发送记录、通知等级、通知对象和失败重试。"
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <SectionCard title="通知模板" description="当前模板按报警等级和通知渠道拆分。">
          <div className="space-y-3">
            {visibleTemplates.map((template) => (
              <div
                key={template.id}
                className="sf-list-row px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[color:var(--text-primary)]">{template.name}</p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-sky-700">
                      {template.channel === "sms" ? "短信" : "站内通知"}
                    </span>
                    <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-rose-700">
                      {template.level === "alarm" ? "报警" : "故障"}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{template.templateText}</p>
                <p className="mt-2 text-xs text-[color:var(--text-muted)]">
                  通知对象：{template.targetRoles.join(" / ")}
                </p>
              </div>
            ))}
          </div>
          <PaginationBar
            page={safeTemplatePage}
            totalPages={templateTotalPages}
            totalItems={templateCount}
            pageSize={TEMPLATE_PAGE_SIZE}
            onPageChange={setTemplatePage}
            label="模板"
          />
        </SectionCard>

        <SectionCard
          title="发送记录"
          description="值守期间重点关注失败通知，必要时可手动重试。"
          extra={
            errorMessage ? (
              <span className="rounded-full border border-[color:rgba(176,72,79,0.18)] bg-[color:var(--danger-soft)] px-3 py-1 text-xs text-[color:var(--danger-strong)]">
                {errorMessage}
              </span>
            ) : null
          }
        >
          <div className="space-y-3">
            {visibleRecords.map((record) => (
              <div
                key={record.id}
                className="sf-list-row px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[color:var(--text-primary)]">{record.targetName}</p>
                    <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                      {record.channel === "sms" ? "短信" : "站内通知"} /{" "}
                      {record.level === "alarm" ? "报警" : "故障"} / {record.createdAt}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs ${
                        record.status === "sent"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : record.status === "failed"
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                      }`}
                    >
                      {record.status === "sent" ? "已发送" : record.status === "failed" ? "失败" : "排队中"}
                    </span>
                    {record.status === "failed" ? (
                      <button
                        type="button"
                        onClick={() => void retryRecord(record.id)}
                        className="sf-button sf-button-primary h-8 px-3 text-xs"
                      >
                        重试
                      </button>
                    ) : null}
                  </div>
                </div>
                <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{record.content}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-[color:var(--text-muted)]">
                  <span>重试次数：{record.retryCount}</span>
                  <span>{record.lastError || "无错误"}</span>
                </div>
              </div>
            ))}
          </div>
          <PaginationBar
            page={safeRecordPage}
            totalPages={recordTotalPages}
            totalItems={records.length}
            pageSize={RECORD_PAGE_SIZE}
            onPageChange={setRecordPage}
            label="发送记录"
          />
        </SectionCard>
      </div>
    </div>
  );
}
