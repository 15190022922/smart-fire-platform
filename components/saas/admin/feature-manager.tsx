"use client";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { FeatureGuard } from "@/components/saas/feature-guard";
import { useSaaSDemo } from "@/components/saas/saas-demo-provider";
import { StatusBadge } from "@/components/status-badge";

export function FeatureManager() {
  const { features, plans } = useSaaSDemo();

  return (
    <FeatureGuard title="功能开关管理" permissionKey="platform.features.manage">
      <div className="space-y-2.5">
        <PageHeader title="功能开关管理" subtitle="查看标准功能目录，并核对各套餐已开通的功能范围。" />
      <SectionCard title="功能目录" description="功能可见性由套餐能力与角色权限共同决定。">
        <div className="space-y-3">
          {features.map((feature) => (
            <div key={feature.key} className="sf-list-row px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--text-primary)]">{feature.name}</p>
                  <p className="mt-1 text-sm text-[color:var(--text-muted)]">{feature.description}</p>
                </div>
                <StatusBadge status={feature.category} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {plans.filter((plan) => plan.featureKeys.includes(feature.key)).map((plan) => (
                  <StatusBadge key={plan.id} status={plan.name} tone="info" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
      </div>
    </FeatureGuard>
  );
}
