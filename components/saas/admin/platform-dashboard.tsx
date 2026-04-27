"use client";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { FeatureGuard } from "@/components/saas/feature-guard";
import { useSaaSDemo } from "@/components/saas/saas-demo-provider";
import { DeviceSimulatorConsole } from "@/components/simulator/device-simulator-console";

export function PlatformDashboard() {
  const { tenants, plans, subscriptions, platformUsers, quotaUsage } = useSaaSDemo();

  const activeTenants = tenants.filter((item) => item.status === "启用").length;
  const activeSubscriptions = subscriptions.filter((item) => item.status === "已生效").length;
  const expiringTrials = subscriptions.filter((item) => item.status === "试用中").length;
  const totalSmsUsed = quotaUsage.reduce((sum, item) => sum + item.smsUsed, 0);

  return (
    <FeatureGuard title="平台首页" permissionKey="platform.dashboard.view">
      <div className="space-y-3 sm:space-y-4">
        <PageHeader
          title="平台总览"
          subtitle="统一查看企业数量、套餐状态、订阅运行情况和平台级运营指标。"
        />

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            {
              label: "企业总数",
              value: String(tenants.length),
              tone: "var(--accent-strong)",
              surface: "var(--accent-soft)",
            },
            {
              label: "启用企业",
              value: String(activeTenants),
              tone: "var(--success-strong)",
              surface: "var(--success-soft)",
            },
            {
              label: "生效订阅",
              value: String(activeSubscriptions),
              tone: "var(--warning-strong)",
              surface: "var(--warning-soft)",
            },
            {
              label: "短信已用量",
              value: `${totalSmsUsed}`,
              tone: "var(--danger-strong)",
              surface: "var(--danger-soft)",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="sf-kpi relative overflow-hidden px-4 py-4 sm:px-5"
              style={{
                background: `linear-gradient(180deg, rgba(255,255,255,0.98) 0%, ${item.surface} 180%)`,
              }}
            >
              <div
                className="absolute inset-x-0 top-0 h-px"
                style={{ background: `linear-gradient(90deg, transparent 0%, ${item.tone} 50%, transparent 100%)` }}
              />
              <p className="sf-label">{item.label}</p>
              <p className="mt-3 text-[28px] font-semibold leading-none tracking-[-0.03em]" style={{ color: item.tone }}>
                {item.value}
              </p>
              <p className="mt-2 text-xs text-[color:var(--text-muted)]">平台运营关键指标</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <SectionCard
            title="企业订阅动态"
            description="当前平台上的企业订阅、试用和停用情况一览。"
          >
            <div className="space-y-3">
              {subscriptions.map((subscription) => {
                const tenant = tenants.find((item) => item.id === subscription.tenantId);
                const plan = plans.find((item) => item.id === subscription.planId);
                const tone =
                  subscription.status === "已生效"
                    ? { text: "var(--success-strong)", bg: "var(--success-soft)" }
                    : subscription.status === "试用中"
                      ? { text: "var(--warning-strong)", bg: "var(--warning-soft)" }
                      : { text: "var(--text-secondary)", bg: "var(--neutral-soft)" };

                return (
                  <div key={subscription.id} className="sf-list-row flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold tracking-[-0.01em] text-[color:var(--text-primary)]">
                        {tenant?.name}
                      </p>
                      <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                        套餐：{plan?.name} / 有效期：{subscription.startDate} - {subscription.endDate}
                      </p>
                    </div>
                    <div
                      className="rounded-full border px-3 py-1.5 text-xs font-semibold"
                      style={{
                        color: tone.text,
                        backgroundColor: tone.bg,
                        borderColor: "var(--border-soft)",
                      }}
                    >
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
              <div className="sf-metric-block px-4 py-3.5">
                <p className="sf-label">平台用户</p>
                <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
                  当前共 <span className="font-semibold text-[color:var(--text-primary)]">{platformUsers.length}</span>{" "}
                  位平台级管理员，具备跨企业管理能力。
                </p>
              </div>
              <div className="sf-metric-block px-4 py-3.5">
                <p className="sf-label">套餐数量</p>
                <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
                  当前维护 <span className="font-semibold text-[color:var(--text-primary)]">{plans.length}</span>{" "}
                  套标准套餐，可按企业规模设置设备数、用户数和短信额度。
                </p>
              </div>
              <div className="sf-metric-block px-4 py-3.5">
                <p className="sf-label">试用企业</p>
                <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
                  目前有 <span className="font-semibold text-[color:var(--text-primary)]">{expiringTrials}</span>{" "}
                  家企业处于试用中，后续可接支付与续费提醒能力。
                </p>
              </div>
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title="设备模拟测试台"
          description="这里直接内嵌平台侧测试控制台。你可以在平台首页直接选择企业、设备并发送火警、故障、离线、恢复、心跳事件，企业端首页和空间页会通过实时通道自动更新。"
        >
          <div className="mb-4 rounded-[16px] border border-[color:rgba(169,107,34,0.18)] bg-[color:var(--warning-soft)] px-4 py-3">
            <p className="sf-label text-[color:var(--warning-strong)]">Testing Notice</p>
            <p className="mt-2 text-sm text-[color:var(--warning-strong)]">
              测试注意：平台管理员和企业用户不能共用同一个浏览器会话。请用当前浏览器登录平台端，再用无痕窗口或另一浏览器登录企业端，否则同一个登录 cookie 会互相覆盖。
            </p>
          </div>
          <div className="rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--surface-admin)] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            <DeviceSimulatorConsole tenants={tenants} initialScene={null} embedded />
          </div>
        </SectionCard>
      </div>
    </FeatureGuard>
  );
}
