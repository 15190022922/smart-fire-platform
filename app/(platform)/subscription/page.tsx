import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { SubscriptionOverview } from "@/components/subscription/subscription-overview";
import { fetchBackendJson } from "@/lib/backend-client";
import { getServerSession } from "@/lib/server-auth";
import type { PlanRecord, SubscriptionRecord, TenantRecord } from "@/types/saas";

export default async function SubscriptionPage() {
  const session = await getServerSession();

  if (!session?.tenantId) {
    notFound();
  }

  const overviewResponse = await fetchBackendJson<{
    tenant?: TenantRecord | null;
    plan?: PlanRecord | null;
    subscription?: SubscriptionRecord | null;
  }>("/api/tenant/overview", { session });
  const overview = overviewResponse.ok ? await overviewResponse.json() : {};

  if (!overview.tenant) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="订阅服务"
        subtitle="查看当前企业套餐、有效期、配额和已开通功能。套餐切换和续费操作统一由平台管理端完成。"
      />
      <SubscriptionOverview
        tenant={overview.tenant}
        plan={overview.plan}
        subscription={overview.subscription}
      />
    </div>
  );
}
