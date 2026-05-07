"use client";

import { useMemo, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { AlertMessage } from "@/components/ui/alert-message";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { FeatureGuard } from "@/components/saas/feature-guard";
import { useSaaSDemo } from "@/components/saas/saas-demo-provider";
import { StatusBadge } from "@/components/status-badge";
import { TenantRecord, TenantStatus, TenantUserRecord } from "@/types/saas";

const inputClassName =
  "sf-input h-11 px-4 text-sm";

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
  const { confirmDialog } = useConfirmDialog();
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
    const result = await confirmDialog({
      title: "删除企业",
      description: `确认删除企业“${tenant.name}”吗？该企业下的账号和数据也会一并删除。`,
      confirmLabel: "删除",
      tone: "danger",
    });
    if (result !== "confirm") {
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
      <div className="space-y-2.5">
        <PageHeader
          title="企业管理"
          subtitle="平台管理员在这里创建企业，并同步生成企业初始管理员账号。企业购买后，企业管理员用初始账号登录并修改密码。"
          aside={
            <button
              type="button"
              onClick={openCreate}
              className="sf-button sf-button-primary h-10 px-4 text-sm"
            >
              新增企业
            </button>
          }
        />

        <SectionCard title="企业列表" description="每个企业即一个 tenant，创建企业时同时创建企业初始管理员账号。">
          <div className="sf-toolbar mb-4 grid gap-3 p-3 lg:grid-cols-[minmax(0,320px)_1fr]">
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="搜索企业名称、编码、行业或联系人"
              className={inputClassName}
            />
            <div className="sf-metric-block flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="sf-label">Tenant Count</p>
                <p className="mt-1 text-sm text-[color:var(--text-secondary)]">当前检索结果</p>
              </div>
              <p className="text-2xl font-semibold leading-none tracking-[-0.03em] text-[color:var(--text-primary)]">
                {filteredTenants.length}
              </p>
            </div>
          </div>

          <div className="sf-table-shell overflow-x-auto">
            <table className="min-w-[980px] text-left text-sm">
              <thead className="sf-table-head">
                <tr>
                  <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.08em]">企业名称</th>
                  <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.08em]">编码</th>
                  <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.08em]">行业</th>
                  <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.08em]">初始管理员</th>
                  <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.08em]">当前套餐</th>
                  <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.08em]">状态</th>
                  <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.08em]">操作</th>
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
                      className="border-t border-[color:var(--border-soft)] transition-colors duration-150 hover:bg-[color:var(--surface-muted)]"
                      style={{
                        backgroundColor: index % 2 === 0 ? "var(--table-row)" : "var(--table-row-alt)",
                      }}
                    >
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-semibold tracking-[-0.01em] text-[color:var(--text-primary)]">
                            {tenant.name}
                          </p>
                          <p className="mt-1 text-xs text-[color:var(--text-muted)]">{tenant.contactName}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-[color:var(--text-secondary)]">{tenant.code}</td>
                      <td className="px-4 py-4 text-[color:var(--text-secondary)]">{tenant.industry}</td>
                      <td className="px-4 py-4 text-[color:var(--text-secondary)]">
                        {admin ? `${admin.username} / ${admin.phone}` : "-"}
                      </td>
                      <td className="px-4 py-4 text-[color:var(--text-secondary)]">
                        {plan?.name ?? "未分配"} / {subscription?.status ?? "-"}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={tenant.status} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openView(tenant)}
                            className="sf-button sf-button-secondary h-8 px-3 text-xs"
                          >
                            详情
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(tenant)}
                            className="sf-button sf-button-primary h-8 px-3 text-xs"
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleStatus(tenant)}
                            className="sf-button sf-button-warning h-8 px-3 text-xs"
                          >
                            {tenant.status === ("启用" as TenantStatus) ? "停用" : "启用"}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeTenant(tenant)}
                            className="sf-button sf-button-danger h-8 px-3 text-xs"
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
                className="sf-button sf-button-secondary h-10 px-4 text-sm"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void saveTenant()}
                disabled={saving}
                className="sf-button sf-button-primary h-10 px-4 text-sm"
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
                className={`${inputClassName} min-h-24 py-3`}
              />
            </label>

            {dialogMode === "create" ? (
              <>
                <div className="sf-metric-block md:col-span-2 px-4 py-3">
                  <p className="sf-label">Initial Admin</p>
                  <p className="mt-1 text-sm text-[color:var(--text-secondary)]">创建企业时同步下发管理员初始账号。</p>
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
              <AlertMessage tone="danger" className="md:col-span-2">
                {error}
              </AlertMessage>
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
                  className="sf-metric-block px-4 py-4"
                >
                  <p className="sf-label">{label}</p>
                  <p className="mt-2 text-base text-[color:var(--text-primary)]">{value}</p>
                </div>
              ))}
              <div className="sf-metric-block px-4 py-4 md:col-span-2">
                <p className="sf-label">备注</p>
                <p className="mt-2 text-base text-[color:var(--text-primary)]">{selectedTenant.note}</p>
              </div>
            </div>
          ) : null}
        </Dialog>
      </div>
    </FeatureGuard>
  );
}
