"use client";

import { useMemo, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { FeatureGuard } from "@/components/saas/feature-guard";
import { useSaaSDemo } from "@/components/saas/saas-demo-provider";
import { TenantRecord, TenantStatus } from "@/types/saas";

const inputClassName =
  "w-full rounded-2xl border border-[color:var(--field-border)] bg-[var(--field-bg)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100";

type TenantFormState = Omit<TenantRecord, "id" | "createdAt">;

const emptyForm: TenantFormState = {
  name: "",
  code: "",
  industry: "",
  contactName: "",
  contactPhone: "",
  status: "启用",
  note: "",
};

export function TenantManager() {
  const { tenants, setTenants, subscriptions, plans } = useSaaSDemo();
  const [searchValue, setSearchValue] = useState("");
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view" | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<TenantRecord | null>(null);
  const [formState, setFormState] = useState<TenantFormState>(emptyForm);

  const filteredTenants = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase();
    return tenants.filter((tenant) =>
      keyword.length === 0
        ? true
        : [tenant.name, tenant.code, tenant.industry, tenant.contactName].join(" ").toLowerCase().includes(keyword),
    );
  }, [searchValue, tenants]);

  function openCreate() {
    setSelectedTenant(null);
    setFormState(emptyForm);
    setDialogMode("create");
  }

  function openEdit(tenant: TenantRecord) {
    setSelectedTenant(tenant);
    setFormState({
      name: tenant.name,
      code: tenant.code,
      industry: tenant.industry,
      contactName: tenant.contactName,
      contactPhone: tenant.contactPhone,
      status: tenant.status,
      note: tenant.note,
    });
    setDialogMode("edit");
  }

  function openView(tenant: TenantRecord) {
    setSelectedTenant(tenant);
    setDialogMode("view");
  }

  function closeDialog() {
    setDialogMode(null);
    setSelectedTenant(null);
  }

  function saveTenant() {
    if (!formState.name || !formState.code) {
      return;
    }

    if (dialogMode === "create") {
      setTenants((current) => [
        {
          id: `tenant-${Date.now()}`,
          createdAt: "2026-04-20",
          ...formState,
        },
        ...current,
      ]);
    }

    if (dialogMode === "edit" && selectedTenant) {
      setTenants((current) =>
        current.map((item) =>
          item.id === selectedTenant.id ? { ...selectedTenant, ...formState } : item,
        ),
      );
    }

    closeDialog();
  }

  function removeTenant(tenant: TenantRecord) {
    if (!window.confirm(`确认删除企业“${tenant.name}”吗？`)) {
      return;
    }
    setTenants((current) => current.filter((item) => item.id !== tenant.id));
  }

  function toggleStatus(tenant: TenantRecord) {
    const nextStatus: TenantStatus = tenant.status === "启用" ? "停用" : "启用";
    setTenants((current) =>
      current.map((item) => (item.id === tenant.id ? { ...item, status: nextStatus } : item)),
    );
  }

  return (
    <FeatureGuard title="企业管理" permissionKey="platform.tenants.manage">
      <div className="space-y-6">
      <PageHeader
        title="企业管理"
        subtitle="管理租户基础信息、企业状态以及当前绑定的套餐订阅关系。"
        aside={
          <button
            type="button"
            onClick={openCreate}
            className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700"
          >
            新增企业
          </button>
        }
      />

      <SectionCard title="企业列表" description="每个企业即一个 tenant，所有业务数据都归属于 tenant_id。">
        <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
          <input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="搜索企业名称、编码、行业或联系人"
            className={inputClassName}
          />
          <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[color:var(--text-secondary)]">
            当前共 {filteredTenants.length} 家企业
          </div>
        </div>

        <div className="overflow-x-auto rounded-[24px] border border-[color:var(--border)]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--table-head)] text-[color:var(--text-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">企业名称</th>
                <th className="px-4 py-3 font-medium">编码</th>
                <th className="px-4 py-3 font-medium">行业</th>
                <th className="px-4 py-3 font-medium">当前套餐</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="bg-[var(--table-row)]">
              {filteredTenants.map((tenant, index) => {
                const subscription = subscriptions.find((item) => item.tenantId === tenant.id);
                const plan = plans.find((item) => item.id === subscription?.planId);

                return (
                  <tr
                    key={tenant.id}
                    className="border-t border-[color:var(--border)]"
                    style={{
                      backgroundColor: index % 2 === 0 ? "var(--table-row)" : "var(--table-row-alt)",
                    }}
                  >
                    <td className="px-4 py-4 font-medium text-[color:var(--text-primary)]">{tenant.name}</td>
                    <td className="px-4 py-4 text-[color:var(--text-secondary)]">{tenant.code}</td>
                    <td className="px-4 py-4 text-[color:var(--text-secondary)]">{tenant.industry}</td>
                    <td className="px-4 py-4 text-[color:var(--text-secondary)]">
                      {plan?.name ?? "未分配"} / {subscription?.status ?? "-"}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full border px-3 py-1 text-xs ${tenant.status === "启用" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-700"}`}>
                        {tenant.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => openView(tenant)} className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs text-[color:var(--text-secondary)]">详情</button>
                        <button type="button" onClick={() => openEdit(tenant)} className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs text-sky-700">编辑</button>
                        <button type="button" onClick={() => toggleStatus(tenant)} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-700">
                          {tenant.status === "启用" ? "停用" : "启用"}
                        </button>
                        <button type="button" onClick={() => removeTenant(tenant)} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-700">删除</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <Dialog
        open={dialogMode === "create" || dialogMode === "edit"}
        onClose={closeDialog}
        title={dialogMode === "create" ? "新增企业" : "编辑企业"}
        description="租户信息仅用于前端演示，后续可直接接入租户管理接口。"
        footer={
          <>
            <button type="button" onClick={closeDialog} className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--text-secondary)]">取消</button>
            <button type="button" onClick={saveTenant} className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-700">保存</button>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ["企业名称", "name"],
            ["企业编码", "code"],
            ["所属行业", "industry"],
            ["联系人", "contactName"],
            ["联系电话", "contactPhone"],
          ].map(([label, key]) => (
            <label key={key} className="space-y-2">
              <span className="text-sm text-[color:var(--text-secondary)]">{label}</span>
              <input
                value={formState[key as keyof TenantFormState] as string}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, [key]: event.target.value }))
                }
                className={inputClassName}
              />
            </label>
          ))}
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">状态</span>
            <select
              value={formState.status}
              onChange={(event) =>
                setFormState((current) => ({ ...current, status: event.target.value as TenantStatus }))
              }
              className={inputClassName}
            >
              <option>启用</option>
              <option>停用</option>
            </select>
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm text-[color:var(--text-secondary)]">备注</span>
            <textarea
              value={formState.note}
              onChange={(event) => setFormState((current) => ({ ...current, note: event.target.value }))}
              className={`${inputClassName} min-h-28`}
            />
          </label>
        </div>
      </Dialog>

      <Dialog open={dialogMode === "view" && !!selectedTenant} onClose={closeDialog} title="企业详情">
        {selectedTenant ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ["企业名称", selectedTenant.name],
              ["企业编码", selectedTenant.code],
              ["所属行业", selectedTenant.industry],
              ["联系人", selectedTenant.contactName],
              ["联系电话", selectedTenant.contactPhone],
              ["创建时间", selectedTenant.createdAt],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-4">
                <p className="text-sm text-[color:var(--text-muted)]">{label}</p>
                <p className="mt-2 text-base text-[color:var(--text-primary)]">{value}</p>
              </div>
            ))}
            <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-4 md:col-span-2">
              <p className="text-sm text-[color:var(--text-muted)]">备注</p>
              <p className="mt-2 text-base text-[color:var(--text-primary)]">{selectedTenant.note}</p>
            </div>
          </div>
        ) : null}
      </Dialog>
      </div>
    </FeatureGuard>
  );
}
