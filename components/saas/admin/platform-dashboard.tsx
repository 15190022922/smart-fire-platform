"use client";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { FeatureGuard } from "@/components/saas/feature-guard";
import { useSaaSDemo } from "@/components/saas/saas-demo-provider";

export function PlatformDashboard() {
  const { tenants, plans, subscriptions, platformUsers, quotaUsage } = useSaaSDemo();

  const activeTenants = tenants.filter((item) => item.status === "启用").length;
  const activeSubscriptions = subscriptions.filter((item) => item.status === "已生效").length;
  const expiringTrials = subscriptions.filter((item) => item.status === "试用中").length;
  const totalSmsUsed = quotaUsage.reduce((sum, item) => sum + item.smsUsed, 0);

  return (
    <FeatureGuard title="平台首页" permissionKey="platform.dashboard.view">
      <div className="space-y-6">
      <PageHeader
        title="平台总览"
        subtitle="统一查看企业数量、套餐状态、订阅运行情况和平台级运营指标。"
      />

      <div className="grid gap-4 xl:grid-cols-4">
        {[
          { label: "企业总数", value: String(tenants.length), tone: "text-sky-700 bg-sky-50 border-sky-200" },
          { label: "启用企业", value: String(activeTenants), tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
          { label: "生效订阅", value: String(activeSubscriptions), tone: "text-amber-700 bg-amber-50 border-amber-200" },
          { label: "短信已用量", value: `${totalSmsUsed}`, tone: "text-rose-700 bg-rose-50 border-rose-200" },
        ].map((item) => (
          <div key={item.label} className={`rounded-[24px] border p-5 shadow-[var(--panel-shadow)] ${item.tone}`}>
            <p className="text-sm">{item.label}</p>
            <p className="mt-3 text-3xl font-semibold">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard
          title="企业订阅动态"
          description="当前平台上的企业订阅、试用和停用情况一览。"
        >
          <div className="space-y-3">
            {subscriptions.map((subscription) => {
              const tenant = tenants.find((item) => item.id === subscription.tenantId);
              const plan = plans.find((item) => item.id === subscription.planId);

              return (
                <div
                  key={subscription.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--text-primary)]">{tenant?.name}</p>
                    <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                      套餐：{plan?.name} / 有效期：{subscription.startDate} - {subscription.endDate}
                    </p>
                  </div>
                  <div className="rounded-full border border-[color:var(--border)] bg-[var(--surface-strong)] px-3 py-1.5 text-sm text-[color:var(--text-secondary)]">
                    {subscription.status}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          title="平台管理说明"
          description="平台端角色拥有跨租户能力，企业端角色则严格限制在本租户内。"
        >
          <div className="space-y-3">
            <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3">
              <p className="text-sm font-semibold text-[color:var(--text-primary)]">平台用户</p>
              <p className="mt-2 text-sm text-[color:var(--text-muted)]">
                当前共 {platformUsers.length} 位平台级管理员，具备跨企业管理能力。
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3">
              <p className="text-sm font-semibold text-[color:var(--text-primary)]">套餐数量</p>
              <p className="mt-2 text-sm text-[color:var(--text-muted)]">
                当前维护 {plans.length} 套标准套餐，可按企业规模设置设备数、用户数和短信额度。
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3">
              <p className="text-sm font-semibold text-[color:var(--text-primary)]">试用企业</p>
              <p className="mt-2 text-sm text-[color:var(--text-muted)]">
                目前有 {expiringTrials} 家企业处于试用中，后续可接支付与续费提醒能力。
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
      </div>
    </FeatureGuard>
  );
}
