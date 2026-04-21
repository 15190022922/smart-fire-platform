"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { FeatureGuard } from "@/components/saas/feature-guard";
import { useSaaSDemo } from "@/components/saas/saas-demo-provider";

const inputClassName =
  "w-full rounded-2xl border border-[color:var(--field-border)] bg-[var(--field-bg)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100";

export function WorkspaceSettingsManager() {
  const { currentPlan, currentSubscription, currentNotificationSetting, currentQuotaUsage, setNotificationSettings, currentTenant } =
    useSaaSDemo();
  const [savedAt, setSavedAt] = useState("");

  const setting = currentNotificationSetting;

  function updateSetting(key: "alarmThreshold" | "mapPlaceholder" | "remark", value: string) {
    if (!currentTenant) {
      return;
    }
    setNotificationSettings((current) =>
      current.map((item) => (item.tenantId === currentTenant.id ? { ...item, [key]: value } : item)),
    );
  }

  function toggleNotificationEnabled() {
    if (!currentTenant) {
      return;
    }
    setNotificationSettings((current) =>
      current.map((item) =>
        item.tenantId === currentTenant.id ? { ...item, notificationEnabled: !item.notificationEnabled } : item,
      ),
    );
  }

  return (
    <FeatureGuard title="系统设置" featureKey="settings" permissionKey="tenant.settings.view">
      <div className="space-y-6">
        <PageHeader
          title="系统设置"
          subtitle="企业设置页按租户隔离保存，当前展示的是本企业的通知与地图配置。"
          aside={
            savedAt ? (
              <div className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                最近保存：{savedAt}
              </div>
            ) : null
          }
        />

        <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <SectionCard title="企业配置" description="后续可直接接真实后端接口，实现按企业持久化保存。">
            <div className="grid gap-4">
              <label className="space-y-2">
                <span className="text-sm text-[color:var(--text-secondary)]">报警阈值</span>
                <input
                  value={setting?.alarmThreshold ?? ""}
                  onChange={(event) => updateSetting("alarmThreshold", event.target.value)}
                  className={inputClassName}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-[color:var(--text-secondary)]">地图/楼层图配置</span>
                <input
                  value={setting?.mapPlaceholder ?? ""}
                  onChange={(event) => updateSetting("mapPlaceholder", event.target.value)}
                  className={inputClassName}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-[color:var(--text-secondary)]">通知说明</span>
                <textarea
                  value={setting?.remark ?? ""}
                  onChange={(event) => updateSetting("remark", event.target.value)}
                  className={`${inputClassName} min-h-28`}
                />
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                <input type="checkbox" checked={setting?.notificationEnabled ?? false} onChange={toggleNotificationEnabled} />
                <span className="text-sm text-[color:var(--text-primary)]">开启企业通知</span>
              </label>
              <div className="flex justify-end">
                <button type="button" onClick={() => setSavedAt("刚刚")} className="rounded-full border border-sky-200 bg-sky-50 px-5 py-2.5 text-sm text-sky-700">
                  保存设置
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="订阅与配额" description="套餐和订阅决定本企业当前可见功能与资源上限。">
            <div className="space-y-4">
              <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-4">
                <p className="text-sm text-[color:var(--text-muted)]">当前套餐</p>
                <p className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">{currentPlan?.name ?? "-"}</p>
                <p className="mt-1 text-sm text-[color:var(--text-secondary)]">订阅状态：{currentSubscription?.status ?? "-"}</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-4">
                <p className="text-sm text-[color:var(--text-muted)]">设备配额</p>
                <p className="mt-2 text-base text-[color:var(--text-primary)]">{currentQuotaUsage?.deviceCount ?? 0} / {currentPlan?.maxDevices ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-4">
                <p className="text-sm text-[color:var(--text-muted)]">用户配额</p>
                <p className="mt-2 text-base text-[color:var(--text-primary)]">{currentQuotaUsage?.userCount ?? 0} / {currentPlan?.maxUsers ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-4">
                <p className="text-sm text-[color:var(--text-muted)]">短信额度</p>
                <p className="mt-2 text-base text-[color:var(--text-primary)]">{currentQuotaUsage?.smsUsed ?? 0} / {currentPlan?.smsQuota ?? 0}</p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </FeatureGuard>
  );
}
