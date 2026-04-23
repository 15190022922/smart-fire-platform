"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";

const inputClassName =
  "w-full rounded-2xl border border-[color:var(--field-border)] bg-[var(--field-bg)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100";

type TenantProfileProps = {
  username: string;
  displayName: string;
  tenantName: string;
  forcePasswordChange?: boolean;
};

export function TenantProfile({
  username,
  displayName,
  tenantName,
  forcePasswordChange = false,
}: TenantProfileProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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

    setCurrentPassword("");
    setNextPassword("");
    setConfirmPassword("");
    setMessage("密码已更新，请使用新密码重新登录。");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="我的"
        subtitle="维护当前企业账号信息与登录密码。企业管理员首次登录后建议立即修改初始密码。"
      />

      {forcePasswordChange ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          当前账号仍在使用平台发放的初始密码，请先完成密码修改。
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title="账号信息" description="当前登录企业账号的基础资料。">
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ["企业名称", tenantName],
              ["登录账号", username],
              ["显示名称", displayName],
              ["账号类型", "企业账号"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-4"
              >
                <p className="text-sm text-[color:var(--text-muted)]">{label}</p>
                <p className="mt-2 text-base font-semibold text-[color:var(--text-primary)]">{value}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="修改密码" description="修改后立即生效。建议企业首次登录后立刻更新密码。">
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
