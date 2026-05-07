"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { AlertMessage } from "@/components/ui/alert-message";
import { fieldClassName as baseFieldClassName } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast-center";

type TenantProfileProps = {
  username: string;
  displayName: string;
  tenantName: string;
  forcePasswordChange?: boolean;
};

type PasswordErrors = Partial<Record<"currentPassword" | "nextPassword" | "confirmPassword", string>>;

function requiredLabel(label: string) {
  return (
    <span className="flex items-center gap-1 text-sm text-[color:var(--text-secondary)]">
      {label}
      <span className="text-[color:var(--danger-strong)]">*</span>
    </span>
  );
}

function inputClassName(hasError: boolean) {
  return `${baseFieldClassName} ${hasError ? "border-[color:var(--danger)] text-[color:var(--danger-strong)] focus:border-[color:var(--danger)]" : ""}`;
}

export function TenantProfile({
  username,
  displayName,
  tenantName,
  forcePasswordChange = false,
}: TenantProfileProps) {
  const { pushToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [requestError, setRequestError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<PasswordErrors>({});

  async function handleChangePassword() {
    const nextErrors: PasswordErrors = {};
    setRequestError("");

    if (!currentPassword) nextErrors.currentPassword = "请输入当前密码";
    if (!nextPassword) nextErrors.nextPassword = "请输入新密码";
    if (!confirmPassword) nextErrors.confirmPassword = "请再次输入新密码";
    if (nextPassword && confirmPassword && nextPassword !== confirmPassword) {
      nextErrors.confirmPassword = "两次输入的新密码不一致";
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, nextPassword }),
    });

    const result = (await response.json()) as { message?: string };
    if (!response.ok) {
      setRequestError(result.message ?? "修改密码失败");
      return;
    }

    setCurrentPassword("");
    setNextPassword("");
    setConfirmPassword("");
    setFieldErrors({});
    pushToast({ message: "密码已更新，请使用新密码重新登录。", tone: "success" });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="我的"
        subtitle="维护当前企业账号信息与登录密码。企业管理员首次登录后建议立即修改初始密码。"
      />

      {forcePasswordChange ? (
        <AlertMessage tone="warning">当前账号仍在使用平台发放的初始密码，请先完成密码修改。</AlertMessage>
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
              <div key={label} className="sf-metric-block px-4 py-4">
                <p className="text-sm text-[color:var(--text-muted)]">{label}</p>
                <p className="mt-2 text-base font-semibold text-[color:var(--text-primary)]">{value}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="修改密码" description="修改后立即生效。建议企业首次登录后立刻更新密码。">
          <div className="grid gap-4">
            <label className="space-y-2">
              {requiredLabel("当前密码")}
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => {
                  setCurrentPassword(event.target.value);
                  setFieldErrors((current) => ({ ...current, currentPassword: "" }));
                }}
                className={inputClassName(Boolean(fieldErrors.currentPassword))}
              />
              {fieldErrors.currentPassword ? <div className="text-xs font-medium text-[color:var(--danger-strong)]">{fieldErrors.currentPassword}</div> : null}
            </label>
            <label className="space-y-2">
              {requiredLabel("新密码")}
              <input
                type="password"
                value={nextPassword}
                onChange={(event) => {
                  setNextPassword(event.target.value);
                  setFieldErrors((current) => ({ ...current, nextPassword: "" }));
                }}
                className={inputClassName(Boolean(fieldErrors.nextPassword))}
              />
              {fieldErrors.nextPassword ? <div className="text-xs font-medium text-[color:var(--danger-strong)]">{fieldErrors.nextPassword}</div> : null}
            </label>
            <label className="space-y-2">
              {requiredLabel("确认新密码")}
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setFieldErrors((current) => ({ ...current, confirmPassword: "" }));
                }}
                className={inputClassName(Boolean(fieldErrors.confirmPassword))}
              />
              {fieldErrors.confirmPassword ? <div className="text-xs font-medium text-[color:var(--danger-strong)]">{fieldErrors.confirmPassword}</div> : null}
            </label>

            {requestError ? <div className="text-sm font-medium text-[color:var(--danger-strong)]">{requestError}</div> : null}

            <div>
              <button
                type="button"
                onClick={handleChangePassword}
                className="sf-button sf-button-primary h-10 px-5 text-sm"
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
