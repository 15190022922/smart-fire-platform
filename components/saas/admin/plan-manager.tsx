"use client";

import { useMemo, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { FeatureGuard } from "@/components/saas/feature-guard";
import { useSaaSDemo } from "@/components/saas/saas-demo-provider";
import { StatusBadge } from "@/components/status-badge";
import { FeatureKey, PlanRecord, PlanStatus } from "@/types/saas";

const inputClassName =
  "sf-input h-11 px-4 text-sm";

type PlanFormState = Omit<PlanRecord, "id">;

export function PlanManager() {
  const { confirmDialog } = useConfirmDialog();
  const { plans, setPlans, features } = useSaaSDemo();
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanRecord | null>(null);
  const [formState, setFormState] = useState<PlanFormState>({
    name: "",
    code: "",
    status: "启用",
    priceMonthly: 0,
    maxDevices: 0,
    maxUsers: 0,
    smsQuota: 0,
    featureKeys: ["dashboard"],
    description: "",
  });

  const planFeatureMap = useMemo(
    () =>
      plans.reduce<Record<string, string[]>>((acc, plan) => {
        acc[plan.id] = features
          .filter((feature) => plan.featureKeys.includes(feature.key))
          .map((feature) => feature.name);
        return acc;
      }, {}),
    [features, plans],
  );

  function openCreate() {
    setSelectedPlan(null);
    setFormState({
      name: "",
      code: "",
      status: "启用",
      priceMonthly: 0,
      maxDevices: 0,
      maxUsers: 0,
      smsQuota: 0,
      featureKeys: ["dashboard"],
      description: "",
    });
    setDialogMode("create");
  }

  function openEdit(plan: PlanRecord) {
    setSelectedPlan(plan);
    setFormState({ ...plan });
    setDialogMode("edit");
  }

  function closeDialog() {
    setDialogMode(null);
    setSelectedPlan(null);
  }

  function toggleFeature(featureKey: FeatureKey) {
    setFormState((current) => {
      const exists = current.featureKeys.includes(featureKey);
      return {
        ...current,
        featureKeys: exists
          ? current.featureKeys.filter((item) => item !== featureKey)
          : [...current.featureKeys, featureKey],
      };
    });
  }

  function savePlan() {
    if (!formState.name || !formState.code) {
      return;
    }

    if (dialogMode === "create") {
      setPlans((current) => [{ id: `plan-${Date.now()}`, ...formState }, ...current]);
    }

    if (dialogMode === "edit" && selectedPlan) {
      setPlans((current) =>
        current.map((item) => (item.id === selectedPlan.id ? { ...selectedPlan, ...formState } : item)),
      );
    }

    closeDialog();
  }

  async function removePlan(plan: PlanRecord) {
    const result = await confirmDialog({
      title: "删除套餐",
      description: `确认删除套餐“${plan.name}”吗？`,
      confirmLabel: "删除",
      tone: "danger",
    });
    if (result !== "confirm") {
      return;
    }
    setPlans((current) => current.filter((item) => item.id !== plan.id));
  }

  return (
    <FeatureGuard title="套餐管理" permissionKey="platform.plans.manage">
      <div className="space-y-2.5">
        <PageHeader
          title="套餐管理"
          subtitle="定义基础版、专业版、企业版等套餐能力，控制功能、配额和短信额度。"
          aside={
            <button type="button" onClick={openCreate} className="sf-button sf-button-primary h-10 px-4 text-sm">
              新增套餐
            </button>
          }
        />

        <SectionCard title="套餐列表" description="套餐决定企业可用功能、设备数、用户数和短信通知额度。">
          <div className="grid gap-4 xl:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="sf-panel-subtle relative overflow-hidden p-4 transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-[var(--panel-shadow)]"
              >
                <div className="absolute inset-x-0 top-0 h-px bg-[var(--glass-highlight)]" />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="sf-label">Service Plan</p>
                    <p className="mt-2 text-[19px] font-semibold tracking-[-0.02em] text-[color:var(--text-primary)]">
                      {plan.name}
                    </p>
                    <p className="mt-1 text-sm text-[color:var(--text-muted)]">{plan.description}</p>
                  </div>
                  <StatusBadge status={plan.status} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2.5 text-sm">
                  <div className="sf-metric-block px-3.5 py-3">
                    <p className="sf-label">月费</p>
                    <p className="mt-2 font-semibold text-[color:var(--text-primary)]">¥ {plan.priceMonthly}</p>
                  </div>
                  <div className="sf-metric-block px-3.5 py-3">
                    <p className="sf-label">短信额度</p>
                    <p className="mt-2 font-semibold text-[color:var(--text-primary)]">{plan.smsQuota}</p>
                  </div>
                  <div className="sf-metric-block px-3.5 py-3">
                    <p className="sf-label">最大设备数</p>
                    <p className="mt-2 font-semibold text-[color:var(--text-primary)]">{plan.maxDevices}</p>
                  </div>
                  <div className="sf-metric-block px-3.5 py-3">
                    <p className="sf-label">最大用户数</p>
                    <p className="mt-2 font-semibold text-[color:var(--text-primary)]">{plan.maxUsers}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {planFeatureMap[plan.id].map((name) => (
                    <StatusBadge key={name} status={name} tone="info" />
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => openEdit(plan)} className="sf-button sf-button-primary h-8 px-3 text-xs">
                    编辑
                  </button>
                  <button type="button" onClick={() => removePlan(plan)} className="sf-button sf-button-danger h-8 px-3 text-xs">
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

      <Dialog
        open={dialogMode === "create" || dialogMode === "edit"}
        onClose={closeDialog}
        title={dialogMode === "create" ? "新增套餐" : "编辑套餐"}
        footer={
          <>
            <button type="button" onClick={closeDialog} className="sf-button sf-button-secondary h-10 px-4 text-sm">取消</button>
            <button type="button" onClick={savePlan} className="sf-button sf-button-primary h-10 px-4 text-sm">保存</button>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">套餐名称</span>
            <input value={formState.name} onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} className={inputClassName} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">套餐编码</span>
            <input value={formState.code} onChange={(event) => setFormState((current) => ({ ...current, code: event.target.value }))} className={inputClassName} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">月费</span>
            <input type="number" value={formState.priceMonthly} onChange={(event) => setFormState((current) => ({ ...current, priceMonthly: Number(event.target.value) }))} className={inputClassName} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">状态</span>
            <select value={formState.status} onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value as PlanStatus }))} className={inputClassName}>
              <option>启用</option>
              <option>停用</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">最大设备数</span>
            <input type="number" value={formState.maxDevices} onChange={(event) => setFormState((current) => ({ ...current, maxDevices: Number(event.target.value) }))} className={inputClassName} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">最大用户数</span>
            <input type="number" value={formState.maxUsers} onChange={(event) => setFormState((current) => ({ ...current, maxUsers: Number(event.target.value) }))} className={inputClassName} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">短信额度</span>
            <input type="number" value={formState.smsQuota} onChange={(event) => setFormState((current) => ({ ...current, smsQuota: Number(event.target.value) }))} className={inputClassName} />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm text-[color:var(--text-secondary)]">套餐说明</span>
            <textarea value={formState.description} onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))} className={`${inputClassName} min-h-24 py-3`} />
          </label>
          <div className="space-y-2 md:col-span-2">
            <span className="text-sm text-[color:var(--text-secondary)]">可用功能</span>
            <div className="flex flex-wrap gap-2">
              {features.map((feature) => {
                const active = formState.featureKeys.includes(feature.key);
                return (
                  <button
                    key={feature.key}
                    type="button"
                    onClick={() => toggleFeature(feature.key)}
                    className={`sf-button h-10 px-4 text-sm ${
                      active ? "sf-button-primary" : "sf-button-secondary"
                    }`}
                  >
                    {feature.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Dialog>
      </div>
    </FeatureGuard>
  );
}
