"use client";

import { useMemo, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { FeatureGuard } from "@/components/saas/feature-guard";
import { useSaaSDemo } from "@/components/saas/saas-demo-provider";
import { TenantRecord, TenantStatus, TenantUserRecord } from "@/types/saas";

const inputClassName =
  "w-full rounded-2xl border border-[color:var(--field-border)] bg-[var(--field-bg)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100";

type TenantFormState = {
  name: string;
  code: string;
  industry: string;
  contactName: string;
  contactPhone: string;
  status: TenantStatus;
  note: string;
  adminUsername: string;
  adminDisplayName: string;
  adminPhone: string;
  adminPassword: string;
};

const emptyForm: TenantFormState = {
  name: "",
  code: "",
  industry: "",
  contactName: "",
  contactPhone: "",
  status: "启用" as TenantStatus,
  note: "",
  adminUsername: "",
  adminDisplayName: "",
  adminPhone: "",
  adminPassword: "",
};

export function TenantManager() {
  const {
    tenants,
    setTenants,
    tenantUsers,
    setTenantUsers,
    setTenantDevices,
    setTenantAlarms,
    setNotificationSettings,
    setQuotaUsage,
    subscriptions,
    setSubscriptions,
    plans,
  } = useSaaSDemo();
  const [searchValue, setSearchValue] = useState("");
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view" | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<TenantRecord | null>(null);
  const [selectedTenantAdmin, setSelectedTenantAdmin] = useState<TenantUserRecord | null>(null);
  const [formState, setFormState] = useState<TenantFormState>(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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
    setSelectedTenantAdmin(null);
    setFormState(emptyForm);
    setError("");
    setDialogMode("create");
  }

  function openEdit(tenant: TenantRecord) {
    const admin = tenantUsers.find((item) => item.tenantId === tenant.id && item.roleKey === "tenant_level_1") ?? null;
    setSelectedTenant(tenant);
    setSelectedTenantAdmin(admin);
    setFormState({
      name: tenant.name,
      code: tenant.code,
      industry: tenant.industry,
      contactName: tenant.contactName,
      contactPhone: tenant.contactPhone,
      status: tenant.status,
      note: tenant.note,
      adminUsername: admin?.username ?? "",
      adminDisplayName: admin?.username ?? "",
      adminPhone: admin?.phone ?? "",
      adminPassword: "",
    });
    setError("");
    setDialogMode("edit");
  }

  function openView(tenant: TenantRecord) {
    const admin = tenantUsers.find((item) => item.tenantId === tenant.id && item.roleKey === "tenant_level_1") ?? null;
    setSelectedTenant(tenant);
    setSelectedTenantAdmin(admin);
    setDialogMode("view");
  }

  function closeDialog() {
    setDialogMode(null);
    setSelectedTenant(null);
    setSelectedTenantAdmin(null);
    setError("");
    setSaving(false);
  }

  async function saveTenant() {
    setError("");

    if (!formState.name || !formState.code || !formState.contactName || !formState.contactPhone) {
      setError("请完整填写企业信息");
      return;
    }

    if (dialogMode === "create") {
      if (
        !formState.adminUsername ||
        !formState.adminDisplayName ||
        !formState.adminPhone ||
        !formState.adminPassword
      ) {
        setError("请完整填写初始管理员信息");
        return;
      }

      setSaving(true);
      const response = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant: {
            name: formState.name,
            code: formState.code,
            industry: formState.industry,
            contactName: formState.contactName,
            contactPhone: formState.contactPhone,
            status: formState.status,
            note: formState.note,
          },
          admin: {
            username: formState.adminUsername,
            displayName: formState.adminDisplayName,
            phone: formState.adminPhone,
            password: formState.adminPassword,
            roleKey: "tenant_level_1",
            note: "企业初始管理员账号",
          },
        }),
      });

      const result = (await response.json()) as {
        message?: string;
        tenant?: TenantRecord;
        tenantUser?: TenantUserRecord;
      };

      if (!response.ok || !result.tenant || !result.tenantUser) {
        setError(result.message ?? "创建企业失败");
        setSaving(false);
        return;
      }

      setTenants((current) => [result.tenant!, ...current]);
      setTenantUsers((current) => [result.tenantUser!, ...current]);
      closeDialog();
      return;
    }

    if (dialogMode === "edit" && selectedTenant) {
      setSaving(true);
      const response = await fetch("/api/admin/tenants", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedTenant.id,
          name: formState.name,
          code: formState.code,
          industry: formState.industry,
          contactName: formState.contactName,
          contactPhone: formState.contactPhone,
          status: formState.status,
          note: formState.note,
        }),
      });

      const result = (await response.json()) as { message?: string; tenant?: TenantRecord };
      if (!response.ok || !result.tenant) {
        setError(result.message ?? "修改企业失败");
        setSaving(false);
        return;
      }

      setTenants((current) => current.map((item) => (item.id === result.tenant!.id ? result.tenant! : item)));
      closeDialog();
    }
  }

  async function removeTenant(tenant: TenantRecord) {
    if (!window.confirm(`确认删除企业“${tenant.name}”吗？该企业下的账号和数据也会一并删除。`)) {
      return;
    }

    const response = await fetch(`/api/admin/tenants?tenantId=${tenant.id}`, { method: "DELETE" });
    if (!response.ok) {
      return;
    }

    setTenants((current) => current.filter((item) => item.id !== tenant.id));
    setTenantUsers((current) => current.filter((item) => item.tenantId !== tenant.id));
    setTenantDevices((current) => current.filter((item) => item.tenantId !== tenant.id));
    setTenantAlarms((current) => current.filter((item) => item.tenantId !== tenant.id));
    setNotificationSettings((current) => current.filter((item) => item.tenantId !== tenant.id));
    setQuotaUsage((current) => current.filter((item) => item.tenantId !== tenant.id));
    setSubscriptions((current) => current.filter((item) => item.tenantId !== tenant.id));
  }

  function toggleStatus(tenant: TenantRecord) {
    const nextStatus: TenantStatus = tenant.status === ("启用" as TenantStatus) ? ("停用" as TenantStatus) : ("启用" as TenantStatus);
    void fetch("/api/admin/tenants", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...tenant, status: nextStatus }),
    }).then(async (response) => {
      const result = (await response.json()) as { tenant?: TenantRecord };
      if (response.ok && result.tenant) {
        setTenants((current) => current.map((item) => (item.id === tenant.id ? result.tenant! : item)));
      }
    });
  }

  return (
    <FeatureGuard title="企业管理" permissionKey="platform.tenants.manage">
      <div className="space-y-6">
        <PageHeader
          title="企业管理"
          subtitle="平台管理员在这里创建企业，并同步生成企业初始管理员账号。企业购买后，企业管理员用初始账号登录并修改密码。"
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

        <SectionCard title="企业列表" description="每个企业即一个 tenant，创建企业时同时创建企业初始管理员账号。">
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
                  <th className="px-4 py-3 font-medium">初始管理员</th>
                  <th className="px-4 py-3 font-medium">当前套餐</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="bg-[var(--table-row)]">
                {filteredTenants.map((tenant, index) => {
                  const subscription = subscriptions.find((item) => item.tenantId === tenant.id);
                  const plan = plans.find((item) => item.id === subscription?.planId);
                  const admin = tenantUsers.find((item) => item.tenantId === tenant.id && item.roleKey === "tenant_level_1");

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
                        {admin ? `${admin.username} / ${admin.phone}` : "-"}
                      </td>
                      <td className="px-4 py-4 text-[color:var(--text-secondary)]">
                        {plan?.name ?? "未分配"} / {subscription?.status ?? "-"}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs ${
                            tenant.status === ("启用" as TenantStatus)
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-slate-100 text-slate-700"
                          }`}
                        >
                          {tenant.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openView(tenant)}
                            className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs text-[color:var(--text-secondary)]"
                          >
                            详情
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(tenant)}
                            className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs text-sky-700"
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleStatus(tenant)}
                            className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-700"
                          >
                            {tenant.status === ("启用" as TenantStatus) ? "停用" : "启用"}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeTenant(tenant)}
                            className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-700"
                          >
                            删除
                          </button>
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
          description={
            dialogMode === "create"
              ? "创建企业时，平台会同步创建企业初始管理员账号。企业首次登录后需要修改初始密码。"
              : "编辑企业基础信息不会重置已有企业管理员账号。"
          }
          footer={
            <>
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--text-secondary)]"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void saveTenant()}
                disabled={saving}
                className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-700 disabled:opacity-60"
              >
                {saving ? "保存中..." : "保存"}
              </button>
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
                  onChange={(event) => setFormState((current) => ({ ...current, [key]: event.target.value }))}
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
                <option value="启用">启用</option>
                <option value="停用">停用</option>
              </select>
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm text-[color:var(--text-secondary)]">备注</span>
              <textarea
                value={formState.note}
                onChange={(event) => setFormState((current) => ({ ...current, note: event.target.value }))}
                className={`${inputClassName} min-h-24`}
              />
            </label>

            {dialogMode === "create" ? (
              <>
                <div className="md:col-span-2 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[color:var(--text-secondary)]">
                  初始管理员信息
                </div>
                <label className="space-y-2">
                  <span className="text-sm text-[color:var(--text-secondary)]">管理员登录账号</span>
                  <input
                    value={formState.adminUsername}
                    onChange={(event) => setFormState((current) => ({ ...current, adminUsername: event.target.value }))}
                    className={inputClassName}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm text-[color:var(--text-secondary)]">管理员姓名</span>
                  <input
                    value={formState.adminDisplayName}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, adminDisplayName: event.target.value }))
                    }
                    className={inputClassName}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm text-[color:var(--text-secondary)]">管理员手机号</span>
                  <input
                    value={formState.adminPhone}
                    onChange={(event) => setFormState((current) => ({ ...current, adminPhone: event.target.value }))}
                    className={inputClassName}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm text-[color:var(--text-secondary)]">初始密码</span>
                  <input
                    type="password"
                    value={formState.adminPassword}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, adminPassword: event.target.value }))
                    }
                    className={inputClassName}
                  />
                </label>
              </>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 md:col-span-2">
                {error}
              </div>
            ) : null}
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
                ["初始管理员账号", selectedTenantAdmin?.username ?? "-"],
                ["初始管理员手机", selectedTenantAdmin?.phone ?? "-"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-4"
                >
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
