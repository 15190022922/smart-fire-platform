import { featureDefinitions, tenantQuotaUsage } from "@/data/saas-data";
import { SectionCard } from "@/components/section-card";
import { PlanRecord, SubscriptionRecord, TenantRecord } from "@/types/saas";

function formatDateRange(startDate: string, endDate: string) {
  return `${startDate} 至 ${endDate}`;
}

export function SubscriptionOverview({
  tenant,
  plan,
  subscription,
}: {
  tenant: TenantRecord;
  plan: PlanRecord | null;
  subscription: SubscriptionRecord | null;
}) {
  const usage = tenantQuotaUsage.find((item) => item.tenantId === tenant.id);
  const enabledFeatureKeys = new Set(plan?.featureKeys ?? []);
  const deviceUsageRatio = usage && plan ? Math.min((usage.deviceCount / plan.maxDevices) * 100, 100) : 0;
  const userUsageRatio = usage && plan ? Math.min((usage.userCount / plan.maxUsers) * 100, 100) : 0;
  const smsUsageRatio = usage && plan ? Math.min((usage.smsUsed / plan.smsQuota) * 100, 100) : 0;

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="grid gap-4">
        <SectionCard
          title="当前订阅"
          description="企业端只展示当前登录企业的套餐、订阅状态和功能开通情况。"
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div className="sf-metric-block p-4">
              <p className="sf-label">企业</p>
              <p className="mt-3 text-xl font-semibold text-[color:var(--text-primary)]">{tenant.name}</p>
              <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{tenant.industry}</p>
            </div>
            <div className="sf-metric-block p-4">
              <p className="sf-label">套餐</p>
              <p className="mt-3 text-xl font-semibold text-[color:var(--text-primary)]">{plan?.name ?? "未分配"}</p>
              <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
                {plan ? `￥${plan.priceMonthly.toLocaleString()}/月` : "请联系平台管理员分配"}
              </p>
            </div>
            <div className="sf-metric-block p-4">
              <p className="sf-label">状态</p>
              <p className="mt-3 text-xl font-semibold text-[color:var(--text-primary)]">
                {subscription?.status ?? "未开通"}
              </p>
              <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
                {subscription ? formatDateRange(subscription.startDate, subscription.endDate) : "暂无有效订阅"}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-[16px] border border-[color:var(--border-soft)] bg-[linear-gradient(180deg,rgba(248,251,254,0.98)_0%,rgba(255,255,255,0.98)_100%)] p-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-[color:var(--text-secondary)]">续费方式</p>
                <p className="mt-2 text-base font-semibold text-[color:var(--text-primary)]">
                  {subscription?.autoRenew ? "自动续费" : "手动续费"}
                </p>
              </div>
              <div>
                <p className="text-sm text-[color:var(--text-secondary)]">试用状态</p>
                <p className="mt-2 text-base font-semibold text-[color:var(--text-primary)]">
                  {subscription?.trial ? "试用中" : "正式订阅"}
                </p>
              </div>
              <div>
                <p className="text-sm text-[color:var(--text-secondary)]">企业编码</p>
                <p className="mt-2 text-base font-semibold text-[color:var(--text-primary)]">{tenant.code}</p>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="已开通功能" description="按钮和菜单的可见性会同时受套餐能力和角色权限控制。">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {featureDefinitions.map((feature) => {
              const enabled = enabledFeatureKeys.has(feature.key);
              return (
                <div
                  key={feature.key}
                  className="sf-panel-subtle p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-base font-semibold text-[color:var(--text-primary)]">{feature.name}</p>
                    <span
                      className={
                        enabled
                          ? "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700"
                          : "rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500"
                      }
                    >
                      {enabled ? "已开通" : "未开通"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[color:var(--text-secondary)]">{feature.description}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.24em] text-[color:var(--text-muted)]">
                    {feature.category}
                  </p>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4">
        <SectionCard title="配额使用" description="当前展示的是前端假数据，后续可以直接改成实时接口。">
          <div className="space-y-3">
            {[
              { label: "设备数", value: usage?.deviceCount ?? 0, total: plan?.maxDevices ?? 0, ratio: deviceUsageRatio, tone: "bg-sky-500" },
              { label: "用户数", value: usage?.userCount ?? 0, total: plan?.maxUsers ?? 0, ratio: userUsageRatio, tone: "bg-emerald-500" },
              { label: "短信额度", value: usage?.smsUsed ?? 0, total: plan?.smsQuota ?? 0, ratio: smsUsageRatio, tone: "bg-amber-500" },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-[color:var(--text-secondary)]">{item.label}</span>
                  <span className="font-medium text-[color:var(--text-primary)]">
                    {item.value} / {item.total || "-"}
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-[var(--surface-contrast)]">
                  <div
                    className={`h-2 rounded-full ${item.tone}`}
                    style={{ width: `${Math.max(item.ratio, 6)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="订阅提示" description="企业端不提供切换企业能力，套餐调整由平台管理端统一执行。">
          <ul className="space-y-3 text-sm leading-6 text-[color:var(--text-secondary)]">
            <li>当前企业只能查看自身订阅，不可切换到其他企业。</li>
            <li>订阅到期、停用或未开通功能时，企业端入口保留但会提示当前套餐未开通。</li>
            <li>后续接真实后端时，可在这里增加账单、续费记录、支付结果和开票信息。</li>
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
