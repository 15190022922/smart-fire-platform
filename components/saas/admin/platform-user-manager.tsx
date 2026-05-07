"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { FeatureGuard } from "@/components/saas/feature-guard";
import { useSaaSDemo } from "@/components/saas/saas-demo-provider";
import { StatusBadge } from "@/components/status-badge";
import { PlatformRoleKey, PlatformUserRecord, UserStatus } from "@/types/saas";

const inputClassName =
  "sf-input h-11 px-4 text-sm";

type PlatformUserFormState = Omit<PlatformUserRecord, "id">;

const roleOptions: PlatformRoleKey[] = [
  "platform_super_admin",
  "platform_ops_admin",
  "platform_finance_admin",
];

export function PlatformUserManager() {
  const { confirmDialog } = useConfirmDialog();
  const { platformUsers, setPlatformUsers, roles } = useSaaSDemo();
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [selectedUser, setSelectedUser] = useState<PlatformUserRecord | null>(null);
  const [formState, setFormState] = useState<PlatformUserFormState>({
    username: "",
    phone: "",
    roleKey: "platform_ops_admin",
    status: "启用",
    note: "",
  });

  function openCreate() {
    setSelectedUser(null);
    setDialogMode("create");
  }

  function openEdit(user: PlatformUserRecord) {
    setSelectedUser(user);
    setFormState({ ...user });
    setDialogMode("edit");
  }

  function closeDialog() {
    setDialogMode(null);
    setSelectedUser(null);
  }

  function saveUser() {
    if (!formState.username || !formState.phone) {
      return;
    }

    if (dialogMode === "create") {
      setPlatformUsers((current) => [{ id: `platform-user-${Date.now()}`, ...formState }, ...current]);
    }

    if (dialogMode === "edit" && selectedUser) {
      setPlatformUsers((current) =>
        current.map((item) => (item.id === selectedUser.id ? { ...selectedUser, ...formState } : item)),
      );
    }

    closeDialog();
  }

  async function removeUser(user: PlatformUserRecord) {
    const result = await confirmDialog({
      title: "删除平台用户",
      description: `确认删除平台用户“${user.username}”吗？`,
      confirmLabel: "删除",
      tone: "danger",
    });
    if (result !== "confirm") {
      return;
    }
    setPlatformUsers((current) => current.filter((item) => item.id !== user.id));
  }

  return (
    <FeatureGuard title="平台用户管理" permissionKey="platform.users.manage">
      <div className="space-y-2.5">
      <PageHeader
        title="平台用户管理"
        subtitle="平台级角色可跨租户管理企业、套餐与订阅，权限范围与企业角色隔离。"
        aside={
          <button type="button" onClick={openCreate} className="sf-button sf-button-primary h-10 px-4 text-sm">
            新增平台用户
          </button>
        }
      />

      <SectionCard title="平台用户列表" description="平台用户不属于具体企业，权限作用域覆盖整个平台。">
        <div className="space-y-3">
          {platformUsers.map((user) => {
            const role = roles.find((item) => item.key === user.roleKey);
            return (
              <div key={user.id} className="sf-list-row flex flex-wrap items-center justify-between gap-3 px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--text-primary)]">{user.username}</p>
                  <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{role?.name} / {user.phone}</p>
                  <p className="mt-1 text-xs text-[color:var(--text-muted)]">{user.note}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={user.status} />
                  <button type="button" onClick={() => openEdit(user)} className="sf-button sf-button-primary h-8 px-3 text-xs">编辑</button>
                  <button type="button" onClick={() => removeUser(user)} className="sf-button sf-button-danger h-8 px-3 text-xs">删除</button>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <Dialog
        open={dialogMode === "create" || dialogMode === "edit"}
        onClose={closeDialog}
        title={dialogMode === "create" ? "新增平台用户" : "编辑平台用户"}
        footer={
          <>
            <button type="button" onClick={closeDialog} className="sf-button sf-button-secondary h-10 px-4 text-sm">取消</button>
            <button type="button" onClick={saveUser} className="sf-button sf-button-primary h-10 px-4 text-sm">保存</button>
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
            <span className="text-sm text-[color:var(--text-secondary)]">角色</span>
            <select value={formState.roleKey} onChange={(event) => setFormState((current) => ({ ...current, roleKey: event.target.value as PlatformRoleKey }))} className={inputClassName}>
              {roleOptions.map((item) => {
                const role = roles.find((roleItem) => roleItem.key === item);
                return <option key={item} value={item}>{role?.name}</option>;
              })}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">状态</span>
            <select value={formState.status} onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value as UserStatus }))} className={inputClassName}>
              <option>启用</option>
              <option>停用</option>
            </select>
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm text-[color:var(--text-secondary)]">备注</span>
            <textarea value={formState.note} onChange={(event) => setFormState((current) => ({ ...current, note: event.target.value }))} className={`${inputClassName} min-h-24 py-3`} />
          </label>
        </div>
      </Dialog>
      </div>
    </FeatureGuard>
  );
}
