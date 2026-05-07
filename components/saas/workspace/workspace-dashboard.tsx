"use client";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { useSaaSDemo } from "@/components/saas/saas-demo-provider";
import { FeatureGuard } from "@/components/saas/feature-guard";
import { StatusBadge } from "@/components/status-badge";

export function WorkspaceDashboard() {
  const { currentTenant, currentPlan, currentSubscription, currentTenantDevices, currentTenantAlarms, currentQuotaUsage } =
    useSaaSDemo();

  const alarmCount = currentTenantAlarms.length;
  const pendingCount = currentTenantAlarms.filter((item) => item.processStatus === "未处理").length;
  const faultCount = currentTenantDevices.filter((item) => item.status === "故障").length;
  const onlineCount = currentTenantDevices.filter((item) => item.status !== "离线").length;

  return (
    <FeatureGuard title="可视化主页面" featureKey="dashboard" permissionKey="tenant.dashboard.view">
      <div className="space-y-6">
        <PageHeader
          title={`${currentTenant?.name ?? "企业工作台"} 总览`}
          subtitle="当前页面已按租户隔离，展示的设备、报警、用户和套餐能力都只属于当前企业。"
          aside={
            <div className="sf-metric-block px-4 py-3">
              <p className="text-sm font-semibold text-[color:var(--text-primary)]">{currentPlan?.name}</p>
              <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                订阅状态：{currentSubscription?.status ?? "-"}
              </p>
            </div>
          }
        />

        <div className="grid gap-4 xl:grid-cols-4">
          {[
            ["当前报警数", alarmCount, "danger"],
            ["未处理报警", pendingCount, "warning"],
            ["在线设备", onlineCount, "success"],
            ["故障设备", faultCount, "info"],
          ].map(([label, value, tone]) => (
            <div key={label} className="sf-metric-block p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-[color:var(--text-secondary)]">{label}</p>
                <StatusBadge status={String(label)} tone={tone as "danger" | "warning" | "success" | "info"} />
              </div>
              <p className="mt-3 text-3xl font-semibold text-[color:var(--text-primary)]">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <SectionCard title="租户隔离说明" description="企业登录后只能看到自己 tenant_id 下的数据和操作入口。">
            <div className="space-y-3">
              <div className="sf-metric-block px-4 py-3">
                <p className="text-sm font-semibold text-[color:var(--text-primary)]">当前企业</p>
                <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{currentTenant?.name}</p>
              </div>
              <div className="sf-metric-block px-4 py-3">
                <p className="text-sm font-semibold text-[color:var(--text-primary)]">套餐能力</p>
                <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
                  未开通功能会在菜单中保留入口并显示“当前套餐未开通”。
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="套餐配额" description="租户当前使用量与套餐配额的对比。">
            <div className="space-y-4">
              {[
                ["设备数", currentQuotaUsage?.deviceCount ?? 0, currentPlan?.maxDevices ?? 0],
                ["用户数", currentQuotaUsage?.userCount ?? 0, currentPlan?.maxUsers ?? 0],
                ["短信额度", currentQuotaUsage?.smsUsed ?? 0, currentPlan?.smsQuota ?? 0],
              ].map(([label, used, limit]) => {
                const ratio = limit ? Math.min(100, Math.round((Number(used) / Number(limit)) * 100)) : 0;
                return (
                  <div key={label}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-[color:var(--text-secondary)]">{label}</span>
                      <span className="text-[color:var(--text-primary)]">
                        {used} / {limit}
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-[var(--surface-muted)]">
                      <div className="h-2.5 rounded-full bg-[var(--accent)]" style={{ width: `${ratio}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      </div>
    </FeatureGuard>
  );
}
