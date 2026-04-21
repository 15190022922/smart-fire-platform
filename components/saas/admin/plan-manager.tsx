"use client";

import { useMemo, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { FeatureGuard } from "@/components/saas/feature-guard";
import { useSaaSDemo } from "@/components/saas/saas-demo-provider";
import { FeatureKey, PlanRecord, PlanStatus } from "@/types/saas";

const inputClassName =
  "w-full rounded-2xl border border-[color:var(--field-border)] bg-[var(--field-bg)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100";

type PlanFormState = Omit<PlanRecord, "id">;

export function PlanManager() {
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

  function removePlan(plan: PlanRecord) {
    if (!window.confirm(`确认删除套餐“${plan.name}”吗？`)) {
      return;
    }
    setPlans((current) => current.filter((item) => item.id !== plan.id));
  }

  return (
    <FeatureGuard title="套餐管理" permissionKey="platform.plans.manage">
      <div className="space-y-6">
      <PageHeader
        title="套餐管理"
        subtitle="定义基础版、专业版、企业版等套餐能力，控制功能、配额和短信额度。"
        aside={
          <button type="button" onClick={openCreate} className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-700">
            新增套餐
          </button>
        }
      />

      <SectionCard title="套餐列表" description="套餐决定企业可用功能、设备数、用户数和短信通知额度。">
        <div className="grid gap-4 xl:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.id} className="rounded-[24px] border border-[color:var(--border)] bg-[var(--surface)] p-5 shadow-[var(--panel-shadow)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-[color:var(--text-primary)]">{plan.name}</p>
                  <p className="mt-1 text-sm text-[color:var(--text-muted)]">{plan.description}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs ${plan.status === "启用" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-700"}`}>
                  {plan.status}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                  <p className="text-[color:var(--text-muted)]">月费</p>
                  <p className="mt-2 font-semibold text-[color:var(--text-primary)]">¥ {plan.priceMonthly}</p>
                </div>
                <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                  <p className="text-[color:var(--text-muted)]">短信额度</p>
                  <p className="mt-2 font-semibold text-[color:var(--text-primary)]">{plan.smsQuota}</p>
                </div>
                <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                  <p className="text-[color:var(--text-muted)]">最大设备数</p>
                  <p className="mt-2 font-semibold text-[color:var(--text-primary)]">{plan.maxDevices}</p>
                </div>
                <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                  <p className="text-[color:var(--text-muted)]">最大用户数</p>
                  <p className="mt-2 font-semibold text-[color:var(--text-primary)]">{plan.maxUsers}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {planFeatureMap[plan.id].map((name) => (
                  <span key={name} className="rounded-full border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-1 text-xs text-[color:var(--text-secondary)]">
                    {name}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => openEdit(plan)} className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs text-sky-700">编辑</button>
                <button type="button" onClick={() => removePlan(plan)} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-700">删除</button>
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
            <button type="button" onClick={closeDialog} className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--text-secondary)]">取消</button>
            <button type="button" onClick={savePlan} className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-700">保存</button>
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
            <textarea value={formState.description} onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))} className={`${inputClassName} min-h-24`} />
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
                    className={`rounded-full border px-4 py-2 text-sm transition ${active ? "border-sky-200 bg-sky-50 text-sky-700" : "border-[color:var(--border)] bg-[var(--surface-strong)] text-[color:var(--text-secondary)]"}`}
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
