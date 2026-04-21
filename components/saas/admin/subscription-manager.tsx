"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { FeatureGuard } from "@/components/saas/feature-guard";
import { useSaaSDemo } from "@/components/saas/saas-demo-provider";
import { SubscriptionRecord, SubscriptionStatus } from "@/types/saas";

const inputClassName =
  "w-full rounded-2xl border border-[color:var(--field-border)] bg-[var(--field-bg)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100";

type SubscriptionFormState = Omit<SubscriptionRecord, "id">;

export function SubscriptionManager() {
  const { subscriptions, setSubscriptions, tenants, plans } = useSaaSDemo();
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [selectedSubscription, setSelectedSubscription] = useState<SubscriptionRecord | null>(null);
  const [formState, setFormState] = useState<SubscriptionFormState>({
    tenantId: tenants[0]?.id ?? "",
    planId: plans[0]?.id ?? "",
    status: "试用中",
    startDate: "2026-04-20",
    endDate: "2026-05-20",
    trial: true,
    autoRenew: false,
  });

  function openCreate() {
    setSelectedSubscription(null);
    setDialogMode("create");
  }

  function openEdit(subscription: SubscriptionRecord) {
    setSelectedSubscription(subscription);
    setFormState({ ...subscription });
    setDialogMode("edit");
  }

  function closeDialog() {
    setDialogMode(null);
    setSelectedSubscription(null);
  }

  function saveSubscription() {
    if (dialogMode === "create") {
      setSubscriptions((current) => [{ id: `sub-${Date.now()}`, ...formState }, ...current]);
    }

    if (dialogMode === "edit" && selectedSubscription) {
      setSubscriptions((current) =>
        current.map((item) =>
          item.id === selectedSubscription.id ? { ...selectedSubscription, ...formState } : item,
        ),
      );
    }

    closeDialog();
  }

  function removeSubscription(subscription: SubscriptionRecord) {
    if (!window.confirm("确认删除该订阅记录吗？")) {
      return;
    }
    setSubscriptions((current) => current.filter((item) => item.id !== subscription.id));
  }

  return (
    <FeatureGuard title="订阅管理" permissionKey="platform.subscriptions.manage">
      <div className="space-y-6">
      <PageHeader
        title="订阅管理"
        subtitle="为企业分配套餐、设置订阅生效时间、试用状态和到期状态。"
        aside={
          <button type="button" onClick={openCreate} className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-700">
            新增订阅
          </button>
        }
      />

      <SectionCard title="订阅列表" description="订阅状态决定租户当前是否可正常使用对应套餐功能。">
        <div className="space-y-3">
          {subscriptions.map((subscription) => {
            const tenant = tenants.find((item) => item.id === subscription.tenantId);
            const plan = plans.find((item) => item.id === subscription.planId);

            return (
              <div key={subscription.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] px-4 py-4 shadow-[var(--panel-shadow)]">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--text-primary)]">{tenant?.name}</p>
                  <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                    {plan?.name} / {subscription.startDate} - {subscription.endDate}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                    {subscription.trial ? "试用订阅" : "正式订阅"} / 自动续费：{subscription.autoRenew ? "是" : "否"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-sm text-[color:var(--text-secondary)]">
                    {subscription.status}
                  </span>
                  <button type="button" onClick={() => openEdit(subscription)} className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs text-sky-700">编辑</button>
                  <button type="button" onClick={() => removeSubscription(subscription)} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-700">删除</button>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <Dialog
        open={dialogMode === "create" || dialogMode === "edit"}
        onClose={closeDialog}
        title={dialogMode === "create" ? "新增订阅" : "编辑订阅"}
        footer={
          <>
            <button type="button" onClick={closeDialog} className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--text-secondary)]">取消</button>
            <button type="button" onClick={saveSubscription} className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-700">保存</button>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">企业</span>
            <select value={formState.tenantId} onChange={(event) => setFormState((current) => ({ ...current, tenantId: event.target.value }))} className={inputClassName}>
              {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">套餐</span>
            <select value={formState.planId} onChange={(event) => setFormState((current) => ({ ...current, planId: event.target.value }))} className={inputClassName}>
              {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">开始时间</span>
            <input value={formState.startDate} onChange={(event) => setFormState((current) => ({ ...current, startDate: event.target.value }))} className={inputClassName} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">到期时间</span>
            <input value={formState.endDate} onChange={(event) => setFormState((current) => ({ ...current, endDate: event.target.value }))} className={inputClassName} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">订阅状态</span>
            <select value={formState.status} onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value as SubscriptionStatus }))} className={inputClassName}>
              <option>试用中</option>
              <option>已生效</option>
              <option>已过期</option>
              <option>已停用</option>
            </select>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3">
            <input type="checkbox" checked={formState.trial} onChange={(event) => setFormState((current) => ({ ...current, trial: event.target.checked }))} />
            <span className="text-sm text-[color:var(--text-primary)]">试用订阅</span>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3 md:col-span-2">
            <input type="checkbox" checked={formState.autoRenew} onChange={(event) => setFormState((current) => ({ ...current, autoRenew: event.target.checked }))} />
            <span className="text-sm text-[color:var(--text-primary)]">自动续费</span>
          </label>
        </div>
      </Dialog>
      </div>
    </FeatureGuard>
  );
}
