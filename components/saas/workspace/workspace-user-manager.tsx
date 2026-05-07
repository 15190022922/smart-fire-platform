"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { FeatureGuard } from "@/components/saas/feature-guard";
import { useSaaSDemo } from "@/components/saas/saas-demo-provider";
import { StatusBadge } from "@/components/status-badge";
import { ActionButton } from "@/components/ui/action-button";
import { DataTable, DataTableCell, DataTableHead, DataTableHeaderCell, DataTableRow, DataTableShell } from "@/components/ui/data-table";
import { checkRowClassName, fieldClassName } from "@/components/ui/form-controls";
import { NotificationType, TenantRoleKey, TenantUserRecord, UserStatus } from "@/types/saas";

const inputClassName = fieldClassName;

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
              <ActionButton onClick={openCreate}>
                新增用户
              </ActionButton>
            ) : null
          }
        />
        <SectionCard title="用户列表" description="短信通知开关与接收信息类型在企业维度内独立配置。">
          <DataTableShell>
            <DataTable>
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell>用户名</DataTableHeaderCell>
                  <DataTableHeaderCell>手机号</DataTableHeaderCell>
                  <DataTableHeaderCell>级别</DataTableHeaderCell>
                  <DataTableHeaderCell>状态</DataTableHeaderCell>
                  <DataTableHeaderCell>短信通知</DataTableHeaderCell>
                  <DataTableHeaderCell>接收信息类型</DataTableHeaderCell>
                  {canManage ? <DataTableHeaderCell>操作</DataTableHeaderCell> : null}
                </tr>
              </DataTableHead>
              <tbody>
                {scopedUsers.map((user, index) => (
                  <DataTableRow key={user.id} stripedIndex={index}>
                    <DataTableCell className="font-medium text-[color:var(--text-primary)]">{user.username}</DataTableCell>
                    <DataTableCell>{user.phone}</DataTableCell>
                    <DataTableCell>{roleLabel(user.roleKey)}</DataTableCell>
                    <DataTableCell><StatusBadge status={user.status} /></DataTableCell>
                    <DataTableCell><StatusBadge status={user.smsEnabled ? "已开启" : "已关闭"} /></DataTableCell>
                    <DataTableCell>
                      <div className="flex flex-wrap gap-2">
                        {user.messageTypes.map((type) => (
                          <StatusBadge key={type} status={type} />
                        ))}
                      </div>
                    </DataTableCell>
                    {canManage ? (
                      <DataTableCell>
                        <ActionButton onClick={() => openEdit(user)} size="xs" variant="primary">
                          编辑
                        </ActionButton>
                      </DataTableCell>
                    ) : null}
                  </DataTableRow>
                ))}
              </tbody>
            </DataTable>
          </DataTableShell>
        </SectionCard>
      </div>

      <Dialog
        open={dialogMode === "create" || dialogMode === "edit"}
        onClose={closeDialog}
        title={dialogMode === "create" ? "新增企业用户" : "编辑企业用户"}
        footer={
          <>
            <ActionButton onClick={closeDialog}>取消</ActionButton>
            <ActionButton onClick={saveUser} variant="primary">保存</ActionButton>
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
          <label className={`${checkRowClassName} md:col-span-2`}>
            <input type="checkbox" checked={formState.smsEnabled} onChange={(event) => setFormState((current) => ({ ...current, smsEnabled: event.target.checked }))} />
            <span className="text-sm text-[color:var(--text-primary)]">开启短信通知</span>
          </label>
          <div className="space-y-2 md:col-span-2">
            <span className="text-sm text-[color:var(--text-secondary)]">接收信息类型</span>
            <div className="flex flex-wrap gap-2">
              {messageTypes.map((type) => {
                const active = formState.messageTypes.includes(type);
                return (
                  <ActionButton key={type} onClick={() => toggleMessage(type)} active={active}>
                    {type}
                  </ActionButton>
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
