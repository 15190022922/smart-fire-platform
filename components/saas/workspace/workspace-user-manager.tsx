"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { FeatureGuard } from "@/components/saas/feature-guard";
import { useSaaSDemo } from "@/components/saas/saas-demo-provider";
import { StatusBadge } from "@/components/status-badge";
import { NotificationType, TenantRoleKey, TenantUserRecord, UserStatus } from "@/types/saas";

const inputClassName =
  "w-full rounded-2xl border border-[color:var(--field-border)] bg-[var(--field-bg)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100";

const roleOptions: TenantRoleKey[] = ["tenant_level_1", "tenant_level_2", "tenant_level_3"];
const messageTypes: NotificationType[] = ["报警信息", "故障信息"];

type UserFormState = Omit<TenantUserRecord, "id" | "tenantId">;

function roleLabel(roleKey: TenantRoleKey) {
  return roleKey === "tenant_level_1" ? "一级用户" : roleKey === "tenant_level_2" ? "二级用户" : "三级用户";
}

export function WorkspaceUserManager() {
  const { currentTenant, tenantUsers, setTenantUsers, hasPermission } = useSaaSDemo();
  const scopedUsers = tenantUsers.filter((item) => item.tenantId === currentTenant?.id);
  const canManage = hasPermission("tenant.users.manage");
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [selectedUser, setSelectedUser] = useState<TenantUserRecord | null>(null);
  const [formState, setFormState] = useState<UserFormState>({
    username: "",
    phone: "",
    roleKey: "tenant_level_1",
    status: "启用",
    smsEnabled: true,
    messageTypes: ["报警信息"],
    note: "",
  });

  function openCreate() {
    setSelectedUser(null);
    setDialogMode("create");
  }

  function openEdit(user: TenantUserRecord) {
    setSelectedUser(user);
    setFormState({
      username: user.username,
      phone: user.phone,
      roleKey: user.roleKey,
      status: user.status,
      smsEnabled: user.smsEnabled,
      messageTypes: user.messageTypes,
      note: user.note,
    });
    setDialogMode("edit");
  }

  function closeDialog() {
    setDialogMode(null);
    setSelectedUser(null);
  }

  function toggleMessage(type: NotificationType) {
    setFormState((current) => ({
      ...current,
      messageTypes: current.messageTypes.includes(type)
        ? current.messageTypes.filter((item) => item !== type)
        : [...current.messageTypes, type],
    }));
  }

  function saveUser() {
    if (!currentTenant) {
      return;
    }

    if (dialogMode === "create") {
      setTenantUsers((current) => [
        {
          id: `tenant-user-${Date.now()}`,
          tenantId: currentTenant.id,
          ...formState,
        },
        ...current,
      ]);
    }

    if (dialogMode === "edit" && selectedUser) {
      setTenantUsers((current) =>
        current.map((item) => (item.id === selectedUser.id ? { ...selectedUser, ...formState } : item)),
      );
    }

    closeDialog();
  }

  return (
    <FeatureGuard title="用户管理" featureKey="user_management" permissionKey="tenant.users.view">
      <div className="space-y-6">
        <PageHeader
          title="企业用户管理"
          subtitle="企业角色分为一级、二级、三级用户，且只能管理本企业内部用户。"
          aside={
            canManage ? (
              <button type="button" onClick={openCreate} className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-700">
                新增用户
              </button>
            ) : null
          }
        />
        <SectionCard title="用户列表" description="短信通知开关与接收信息类型在企业维度内独立配置。">
          <div className="overflow-x-auto rounded-[24px] border border-[color:var(--border)]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--table-head)] text-[color:var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">用户名</th>
                  <th className="px-4 py-3 font-medium">手机号</th>
                  <th className="px-4 py-3 font-medium">级别</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">短信通知</th>
                  <th className="px-4 py-3 font-medium">接收信息类型</th>
                  {canManage ? <th className="px-4 py-3 font-medium">操作</th> : null}
                </tr>
              </thead>
              <tbody>
                {scopedUsers.map((user, index) => (
                  <tr key={user.id} className="border-t border-[color:var(--border)]" style={{ backgroundColor: index % 2 === 0 ? "var(--table-row)" : "var(--table-row-alt)" }}>
                    <td className="px-4 py-4 font-medium text-[color:var(--text-primary)]">{user.username}</td>
                    <td className="px-4 py-4 text-[color:var(--text-secondary)]">{user.phone}</td>
                    <td className="px-4 py-4 text-[color:var(--text-secondary)]">{roleLabel(user.roleKey)}</td>
                    <td className="px-4 py-4"><StatusBadge status={user.status} /></td>
                    <td className="px-4 py-4 text-[color:var(--text-secondary)]">{user.smsEnabled ? "已开启" : "已关闭"}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {user.messageTypes.map((type) => (
                          <span key={type} className="rounded-full border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-1 text-xs text-[color:var(--text-secondary)]">
                            {type}
                          </span>
                        ))}
                      </div>
                    </td>
                    {canManage ? (
                      <td className="px-4 py-4">
                        <button type="button" onClick={() => openEdit(user)} className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs text-sky-700">
                          编辑
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      <Dialog
        open={dialogMode === "create" || dialogMode === "edit"}
        onClose={closeDialog}
        title={dialogMode === "create" ? "新增企业用户" : "编辑企业用户"}
        footer={
          <>
            <button type="button" onClick={closeDialog} className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--text-secondary)]">取消</button>
            <button type="button" onClick={saveUser} className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-700">保存</button>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">用户名</span>
            <input value={formState.username} onChange={(event) => setFormState((current) => ({ ...current, username: event.target.value }))} className={inputClassName} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">手机号</span>
            <input value={formState.phone} onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value }))} className={inputClassName} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">用户级别</span>
            <select value={formState.roleKey} onChange={(event) => setFormState((current) => ({ ...current, roleKey: event.target.value as TenantRoleKey }))} className={inputClassName}>
              {roleOptions.map((roleKey) => <option key={roleKey} value={roleKey}>{roleLabel(roleKey)}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">状态</span>
            <select value={formState.status} onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value as UserStatus }))} className={inputClassName}>
              <option>启用</option>
              <option>停用</option>
            </select>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3 md:col-span-2">
            <input type="checkbox" checked={formState.smsEnabled} onChange={(event) => setFormState((current) => ({ ...current, smsEnabled: event.target.checked }))} />
            <span className="text-sm text-[color:var(--text-primary)]">开启短信通知</span>
          </label>
          <div className="space-y-2 md:col-span-2">
            <span className="text-sm text-[color:var(--text-secondary)]">接收信息类型</span>
            <div className="flex flex-wrap gap-2">
              {messageTypes.map((type) => {
                const active = formState.messageTypes.includes(type);
                return (
                  <button key={type} type="button" onClick={() => toggleMessage(type)} className={`rounded-full border px-4 py-2 text-sm ${active ? "border-sky-200 bg-sky-50 text-sky-700" : "border-[color:var(--border)] bg-[var(--surface-strong)] text-[color:var(--text-secondary)]"}`}>
                    {type}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm text-[color:var(--text-secondary)]">备注</span>
            <textarea value={formState.note} onChange={(event) => setFormState((current) => ({ ...current, note: event.target.value }))} className={`${inputClassName} min-h-24`} />
          </label>
        </div>
      </Dialog>
    </FeatureGuard>
  );
}
