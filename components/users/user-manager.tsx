"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";

type UserStatus = "启用" | "停用";
type UserLevel = "一级用户" | "二级用户" | "三级用户";
type NotificationMessageType = "报警信息" | "故障信息";

type UserRecord = {
  id: string;
  username: string;
  phone: string;
  level: UserLevel;
  status: UserStatus;
  smsEnabled: boolean;
  messageTypes: NotificationMessageType[];
  note: string;
};

type TenantUserApiRecord = {
  id: string;
  username: string;
  phone: string;
  roleKey: "tenant_level_1" | "tenant_level_2" | "tenant_level_3";
  status: UserStatus;
  smsEnabled: boolean;
  messageTypes: NotificationMessageType[];
  note: string;
};

type UserFormState = {
  id?: string;
  username: string;
  phone: string;
  level: UserLevel;
  status: UserStatus;
  smsEnabled: boolean;
  messageTypes: NotificationMessageType[];
  note: string;
};

const inputClassName = "sf-input h-11 px-4 text-sm";

const mutedCardClassName = "sf-metric-block px-3.5 py-2.5";

const userLevels: UserLevel[] = ["一级用户", "二级用户", "三级用户"];
const messageTypes: NotificationMessageType[] = ["报警信息", "故障信息"];

function levelToRoleKey(level: UserLevel) {
  if (level === "一级用户") return "tenant_level_1";
  if (level === "二级用户") return "tenant_level_2";
  return "tenant_level_3";
}

function roleKeyToLevel(roleKey: TenantUserApiRecord["roleKey"]): UserLevel {
  if (roleKey === "tenant_level_1") return "一级用户";
  if (roleKey === "tenant_level_2") return "二级用户";
  return "三级用户";
}

function toUserRecord(user: TenantUserApiRecord): UserRecord {
  return {
    id: user.id,
    username: user.username,
    phone: user.phone,
    level: roleKeyToLevel(user.roleKey),
    status: user.status,
    smsEnabled: user.smsEnabled,
    messageTypes: user.messageTypes,
    note: user.note,
  };
}

function toApiPayload(form: UserFormState) {
  return {
    id: form.id,
    username: form.username,
    phone: form.phone,
    roleKey: levelToRoleKey(form.level),
    status: form.status,
    smsEnabled: form.smsEnabled,
    messageTypes: form.messageTypes,
    note: form.note,
  };
}

function getDefaultMessageTypes(level: UserLevel): NotificationMessageType[] {
  return level === "三级用户" ? ["报警信息", "故障信息"] : ["报警信息"];
}

const emptyUserForm: UserFormState = {
  username: "",
  phone: "",
  level: "一级用户",
  status: "启用",
  smsEnabled: true,
  messageTypes: ["报警信息"],
  note: "",
};

export function UserManager() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchValue, setSearchValue] = useState("");
  const [levelFilter, setLevelFilter] = useState<UserLevel | "全部">("全部");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "全部">("全部");
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view" | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [formState, setFormState] = useState<UserFormState>(emptyUserForm);
  const [page, setPage] = useState(1);
  const pageSize = 6;

  useEffect(() => {
    let active = true;

    async function loadUsers() {
      const response = await fetch("/api/tenant/users", { cache: "no-store" });
      if (!response.ok) {
        setLoading(false);
        return;
      }
      const result = (await response.json()) as { users: TenantUserApiRecord[] };
      if (!active) return;
      setUsers((result.users ?? []).map(toUserRecord));
      setLoading(false);
    }

    void loadUsers();
    return () => {
      active = false;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const keyword = searchValue.trim().toLowerCase();
      const matchKeyword =
        keyword.length === 0
          ? true
          : [user.username, user.phone, user.level, user.messageTypes.join(" ")]
              .join(" ")
              .toLowerCase()
              .includes(keyword);
      const matchLevel = levelFilter === "全部" ? true : user.level === levelFilter;
      const matchStatus = statusFilter === "全部" ? true : user.status === statusFilter;
      return matchKeyword && matchLevel && matchStatus;
    });
  }, [levelFilter, searchValue, statusFilter, users]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [currentPage, filteredUsers]);

  function openCreateDialog() {
    setSelectedUser(null);
    setFormState(emptyUserForm);
    setDialogMode("create");
  }

  function openEditDialog(user: UserRecord) {
    setSelectedUser(user);
    setFormState({
      id: user.id,
      username: user.username,
      phone: user.phone,
      level: user.level,
      status: user.status,
      smsEnabled: user.smsEnabled,
      messageTypes: user.messageTypes,
      note: user.note,
    });
    setDialogMode("edit");
  }

  function openViewDialog(user: UserRecord) {
    setSelectedUser(user);
    setDialogMode("view");
  }

  function closeDialog() {
    setDialogMode(null);
    setSelectedUser(null);
  }

  async function handleSubmit() {
    if (!formState.username || !formState.phone) {
      return;
    }

    const response = await fetch("/api/tenant/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toApiPayload(formState)),
    });

    if (!response.ok) {
      return;
    }

    const result = (await response.json()) as { user: TenantUserApiRecord };
    const nextUser = toUserRecord(result.user);

    if (dialogMode === "create") {
      setUsers((current) => [nextUser, ...current]);
      setPage(1);
    } else if (dialogMode === "edit" && selectedUser) {
      setUsers((current) => current.map((user) => (user.id === selectedUser.id ? nextUser : user)));
    }

    closeDialog();
  }

  async function handleDelete(user: UserRecord) {
    if (!window.confirm(`确认删除用户“${user.username}”吗？`)) {
      return;
    }

    const response = await fetch(`/api/tenant/users?id=${user.id}`, { method: "DELETE" });
    if (!response.ok) {
      return;
    }

    setUsers((current) => current.filter((item) => item.id !== user.id));
  }

  function toggleMessageType(type: NotificationMessageType) {
    setFormState((current) => {
      const exists = current.messageTypes.includes(type);
      return {
        ...current,
        messageTypes: exists
          ? current.messageTypes.filter((item) => item !== type)
          : [...current.messageTypes, type],
      };
    });
  }

  return (
    <div className="space-y-2.5">
      <PageHeader
        title="用户管理"
        subtitle="企业用户、短信通知和接收类型现在会写入本地数据库，刷新页面和重新登录后仍会保留。"
        aside={
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { title: "一级用户", desc: "可管理本企业用户、设备和设置。" },
              { title: "二级用户", desc: "适合值班管理员，重点处理报警和设备。" },
              { title: "三级用户", desc: "适合执行层，默认接收报警和故障。" },
            ].map((item) => (
              <div key={item.title} className={mutedCardClassName}>
                <p className="text-sm font-semibold text-[color:var(--text-primary)]">{item.title}</p>
                <p className="mt-2 text-xs leading-6 text-[color:var(--text-muted)]">{item.desc}</p>
              </div>
            ))}
          </div>
        }
      />

      <SectionCard
        title="用户列表"
        description="支持用户新增、编辑、删除、分页和短信接收配置。"
        extra={
          <button type="button" onClick={openCreateDialog} className="sf-button sf-button-primary h-10 px-4 text-sm">
            新增用户
          </button>
        }
      >
        <div className="sf-toolbar grid gap-3 p-3 lg:grid-cols-[minmax(0,320px)_auto_auto]">
          <input
            value={searchValue}
            onChange={(event) => {
              setSearchValue(event.target.value);
              setPage(1);
            }}
            placeholder="搜索用户名、手机号或接收信息类型"
            className={inputClassName}
          />
          <div className="flex flex-wrap gap-2">
            {(["全部", ...userLevels] as Array<UserLevel | "全部">).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => {
                  setLevelFilter(level);
                  setPage(1);
                }}
                className={`sf-button h-10 px-4 text-sm ${levelFilter === level ? "sf-button-primary" : "sf-button-secondary"}`}
              >
                {level}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(["全部", "启用", "停用"] as Array<UserStatus | "全部">).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => {
                  setStatusFilter(status);
                  setPage(1);
                }}
                className={`sf-button h-10 px-4 text-sm ${statusFilter === status ? "sf-button-primary" : "sf-button-secondary"}`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="sf-table-shell mt-5 overflow-x-auto">
          <table className="min-w-[860px] text-left text-sm">
            <thead className="sf-table-head">
              <tr>
                <th className="px-4 py-3 font-medium">用户名</th>
                <th className="px-4 py-3 font-medium">手机号</th>
                <th className="px-4 py-3 font-medium">用户级别</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">短信通知</th>
                <th className="px-4 py-3 font-medium">接收信息类型</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="bg-[var(--table-row)]">
              {pagedUsers.map((user, index) => (
                <tr
                  key={user.id}
                  className="border-t border-[color:var(--border-soft)] text-[color:var(--text-secondary)] transition-colors duration-150 hover:bg-[color:var(--surface-muted)]"
                  style={{
                    backgroundColor: index % 2 === 0 ? "var(--table-row)" : "var(--table-row-alt)",
                  }}
                >
                  <td className="px-4 py-4 font-medium text-[color:var(--text-primary)]">{user.username}</td>
                  <td className="px-4 py-4">{user.phone}</td>
                  <td className="px-4 py-4">{user.level}</td>
                  <td className="px-4 py-4">
                    <StatusBadge status={user.status} />
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                        user.smsEnabled
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-100 text-slate-700"
                      }`}
                    >
                      {user.smsEnabled ? "已开启" : "已关闭"}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex max-w-56 flex-wrap gap-2">
                      {user.messageTypes.map((type) => (
                        <span
                          key={type}
                          className="rounded-full border border-[color:var(--border-soft)] bg-white/80 px-2.5 py-1 text-xs text-[color:var(--text-secondary)]"
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openViewDialog(user)}
                        className="sf-button sf-button-secondary h-8 px-3 text-xs"
                      >
                        详情
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditDialog(user)}
                        className="sf-button sf-button-primary h-8 px-3 text-xs"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(user)}
                        className="sf-button sf-button-danger h-8 px-3 text-xs"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-[color:var(--text-muted)]">
            {loading ? "正在加载用户数据..." : `第 ${currentPage} / ${totalPages} 页`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="sf-button sf-button-secondary h-10 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              上一页
            </button>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              className="sf-button sf-button-secondary h-10 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              下一页
            </button>
          </div>
        </div>
      </SectionCard>

      <Dialog
        open={dialogMode === "create" || dialogMode === "edit"}
        onClose={closeDialog}
        title={dialogMode === "create" ? "新增用户" : "编辑用户"}
        description="用户级别和短信接收规则会直接写入本地数据库。"
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
              onClick={handleSubmit}
              className="sf-button sf-button-primary h-10 px-4 text-sm"
            >
              保存
            </button>
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
            <select
              value={formState.level}
              onChange={(event) => {
                const level = event.target.value as UserLevel;
                setFormState((current) => ({
                  ...current,
                  level,
                  messageTypes: getDefaultMessageTypes(level),
                }));
              }}
              className={inputClassName}
            >
              {userLevels.map((level) => (
                <option key={level}>{level}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">启用状态</span>
            <select value={formState.status} onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value as UserStatus }))} className={inputClassName}>
              <option>启用</option>
              <option>停用</option>
            </select>
          </label>
          <label className="sf-checkrow px-4 py-3 md:col-span-2">
            <input type="checkbox" checked={formState.smsEnabled} onChange={(event) => setFormState((current) => ({ ...current, smsEnabled: event.target.checked }))} />
            <span className="text-sm text-[color:var(--text-primary)]">开启短信通知</span>
          </label>
          <div className="space-y-2 md:col-span-2">
            <span className="text-sm text-[color:var(--text-secondary)]">接收信息类型</span>
            <div className="flex flex-wrap gap-2">
              {messageTypes.map((type) => {
                const active = formState.messageTypes.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleMessageType(type)}
                    className={`sf-button h-10 px-4 text-sm ${active ? "sf-button-primary" : "sf-button-secondary"}`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm text-[color:var(--text-secondary)]">备注</span>
            <textarea value={formState.note} onChange={(event) => setFormState((current) => ({ ...current, note: event.target.value }))} className={`${inputClassName} min-h-24 py-3`} />
          </label>
        </div>
      </Dialog>

      <Dialog open={dialogMode === "view" && !!selectedUser} onClose={closeDialog} title="用户详情">
        {selectedUser ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className={mutedCardClassName}>
              <p className="text-sm text-[color:var(--text-muted)]">用户名</p>
              <p className="mt-2 text-base font-semibold text-[color:var(--text-primary)]">{selectedUser.username}</p>
            </div>
            <div className={mutedCardClassName}>
              <p className="text-sm text-[color:var(--text-muted)]">手机号</p>
              <p className="mt-2 text-base text-[color:var(--text-primary)]">{selectedUser.phone}</p>
            </div>
            <div className={mutedCardClassName}>
              <p className="text-sm text-[color:var(--text-muted)]">用户级别</p>
              <p className="mt-2 text-base text-[color:var(--text-primary)]">{selectedUser.level}</p>
            </div>
            <div className={mutedCardClassName}>
              <p className="text-sm text-[color:var(--text-muted)]">启用状态</p>
              <div className="mt-2">
                <StatusBadge status={selectedUser.status} />
              </div>
            </div>
            <div className={`${mutedCardClassName} md:col-span-2`}>
              <p className="text-sm text-[color:var(--text-muted)]">短信通知</p>
              <p className="mt-2 text-base text-[color:var(--text-primary)]">
                {selectedUser.smsEnabled ? "已开启" : "已关闭"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedUser.messageTypes.map((type) => (
                  <span
                    key={type}
                    className="rounded-full border border-[color:var(--border-soft)] bg-white/80 px-3 py-1 text-xs text-[color:var(--text-secondary)]"
                  >
                    {type}
                  </span>
                ))}
              </div>
            </div>
            <div className={`${mutedCardClassName} md:col-span-2`}>
              <p className="text-sm text-[color:var(--text-muted)]">备注</p>
              <p className="mt-2 text-base leading-7 text-[color:var(--text-primary)]">{selectedUser.note}</p>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
