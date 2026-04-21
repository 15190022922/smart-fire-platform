"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const demoAccounts = [
  { scope: "平台管理端", username: "platform_admin", password: "Admin123456" },
  { scope: "企业端 / 华星制造", username: "hx_admin", password: "Hx123456" },
  { scope: "企业端 / 安和商业中心", username: "ah_admin", password: "Ah123456" },
];

export function LoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [username, setUsername] = useState("hx_admin");
  const [password, setPassword] = useState("Hx123456");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const result = (await response.json()) as { message?: string; redirectTo?: string };

    if (!response.ok) {
      setError(result.message ?? "登录失败");
      return;
    }

    startTransition(() => {
      router.push(result.redirectTo ?? "/");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-4 py-10 lg:grid-cols-[1fr_420px]">
      <section className="rounded-[32px] border border-[color:var(--border)] bg-[var(--surface)] p-8 shadow-[var(--panel-shadow)]">
        <p className="text-xs uppercase tracking-[0.32em] text-sky-700">Smart Fire SaaS</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[color:var(--text-primary)]">
          智慧消防平台登录
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-[color:var(--text-secondary)]">
          当前保留两个正式端口：平台管理端走 <code className="rounded bg-[var(--surface-muted)] px-2 py-1">/admin</code>
          ，企业端走 <code className="rounded bg-[var(--surface-muted)] px-2 py-1">/</code>。企业账号登录后只会进入自己的企业工作台。
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {demoAccounts.map((account) => (
            <button
              key={account.username}
              type="button"
              onClick={() => {
                setUsername(account.username);
                setPassword(account.password);
              }}
              className="rounded-[24px] border border-[color:var(--border)] bg-[var(--surface-muted)] p-4 text-left transition hover:bg-[var(--surface-strong)]"
            >
              <p className="text-sm font-semibold text-[color:var(--text-primary)]">{account.scope}</p>
              <p className="mt-3 text-xs text-[color:var(--text-muted)]">用户名：{account.username}</p>
              <p className="mt-1 text-xs text-[color:var(--text-muted)]">密码：{account.password}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[32px] border border-[color:var(--border)] bg-[var(--surface)] p-8 shadow-[var(--panel-shadow)]">
        <h2 className="text-2xl font-semibold text-[color:var(--text-primary)]">账号登录</h2>
        <p className="mt-2 text-sm text-[color:var(--text-muted)]">
          当前后端为 mock API，会话使用 httpOnly Cookie，便于先把多端路由和权限流程跑通。
        </p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">用户名</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-2xl border border-[color:var(--field-border)] bg-[var(--field-bg)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">密码</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-[color:var(--field-border)] bg-[var(--field-bg)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700 transition hover:bg-sky-100 disabled:opacity-60"
          >
            {isPending ? "登录中..." : "登录"}
          </button>
        </form>
      </section>
    </div>
  );
}
