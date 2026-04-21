"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";

const inputClassName =
  "w-full rounded-2xl border border-[color:var(--field-border)] bg-[var(--field-bg)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100";

export function AdminProfile() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleChangePassword() {
    setError("");
    setMessage("");

    if (!currentPassword || !nextPassword || !confirmPassword) {
      setError("请完整填写密码信息");
      return;
    }

    if (nextPassword !== confirmPassword) {
      setError("两次输入的新密码不一致");
      return;
    }

    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, nextPassword }),
    });

    const result = (await response.json()) as { message?: string };
    if (!response.ok) {
      setError(result.message ?? "修改密码失败");
      return;
    }

    setMessage("密码已更新，下次登录请使用新密码");
    setCurrentPassword("");
    setNextPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="我的"
        subtitle="平台端固定为唯一超级管理员账号。这里提供管理员自身的密码和基础偏好配置入口。"
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title="管理员信息" description="当前平台只有唯一管理员账号，不再支持多管理员切换。">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-4">
              <p className="text-sm text-[color:var(--text-muted)]">账号类型</p>
              <p className="mt-2 text-base font-semibold text-[color:var(--text-primary)]">平台唯一超级管理员</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-4">
              <p className="text-sm text-[color:var(--text-muted)]">权限范围</p>
              <p className="mt-2 text-base font-semibold text-[color:var(--text-primary)]">全部企业、全部套餐、全部订阅</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-4 md:col-span-2">
              <p className="text-sm text-[color:var(--text-muted)]">说明</p>
              <p className="mt-2 text-base leading-7 text-[color:var(--text-primary)]">
                管理端不是“每个企业一个管理员”，而是平台侧一个唯一总管理员，统一查看所有企业数据并执行全局管理。
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="修改密码" description="密码修改后会立即写入本地数据库，重新登录时生效。">
          <div className="grid gap-4">
            <label className="space-y-2">
              <span className="text-sm text-[color:var(--text-secondary)]">当前密码</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className={inputClassName}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-[color:var(--text-secondary)]">新密码</span>
              <input
                type="password"
                value={nextPassword}
                onChange={(event) => setNextPassword(event.target.value)}
                className={inputClassName}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-[color:var(--text-secondary)]">确认新密码</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className={inputClassName}
              />
            </label>

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}
            {message ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {message}
              </div>
            ) : null}

            <div>
              <button
                type="button"
                onClick={handleChangePassword}
                className="rounded-full border border-sky-200 bg-sky-50 px-5 py-2.5 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
              >
                保存新密码
              </button>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
