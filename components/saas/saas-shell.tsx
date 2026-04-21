"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { useSaaSDemo } from "./saas-demo-provider";
import { LogoutButton } from "@/components/layout/logout-button";

const adminNavigationLinks = [
  { href: "/admin", label: "平台首页" },
  { href: "/admin/tenants", label: "企业管理" },
  { href: "/admin/plans", label: "套餐管理" },
  { href: "/admin/subscriptions", label: "订阅管理" },
  { href: "/admin/features", label: "功能开关" },
  { href: "/admin/profile", label: "我的" },
];

function isEnabledStatus(status?: string | null) {
  return status === "启用" || status === "鍚敤";
}

function isActiveSubscription(status?: string | null) {
  return status === "已生效" || status === "试用中" || status === "宸茬敓鏁?" || status === "璇曠敤涓?";
}

export function SaaSShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { tenants, subscriptions, plans } = useSaaSDemo();

  const activeSubscriptions = subscriptions.filter((item) => isActiveSubscription(item.status));
  const activeTenants = tenants.filter((item) => isEnabledStatus(item.status));
  const enterprisePlanCount = plans.length;

  return (
    <div className="flex h-screen overflow-hidden bg-[linear-gradient(180deg,#f8fbfd_0%,#f2f6fb_100%)]">
      <aside className="hidden w-72 shrink-0 border-r border-[color:var(--border)] bg-[var(--surface)] px-4 py-4 lg:flex lg:flex-col">
        <div className="rounded-[24px] border border-[color:var(--border)] bg-[var(--surface-strong)] px-4 py-4 shadow-[var(--panel-shadow)]">
          <p className="text-xs uppercase tracking-[0.28em] text-sky-700">Platform SaaS</p>
          <h1 className="mt-3 text-xl font-semibold text-[color:var(--text-primary)]">平台管理端</h1>
          <p className="mt-2 text-sm text-[color:var(--text-muted)]">
            平台端只有一个唯一超级管理员账号，默认拥有全部权限，可统一查看并管理所有企业数据。
          </p>
        </div>

        <div className="mt-4 grid gap-3">
          {[
            { label: "启用企业", value: activeTenants.length },
            { label: "有效订阅", value: activeSubscriptions.length },
            { label: "套餐数量", value: enterprisePlanCount },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">{item.label}</p>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">{item.value}</p>
            </div>
          ))}
        </div>

        <nav className="mt-4 space-y-2">
          {adminNavigationLinks.map((link) => {
            const active = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition",
                  active
                    ? "border-sky-200 bg-sky-50 text-sky-700"
                    : "border-[color:var(--border)] bg-[var(--surface-strong)] text-[color:var(--text-secondary)] hover:bg-[var(--surface-muted)]",
                )}
              >
                <span>{link.label}</span>
                <span className="text-[11px] text-[color:var(--text-muted)]">管理</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-[24px] border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-4">
          <p className="text-sm font-semibold text-[color:var(--text-primary)]">管理员说明</p>
          <p className="mt-3 text-sm leading-6 text-[color:var(--text-secondary)]">
            当前平台端不再支持多管理员切换，平台唯一账号固定为超级管理员。
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-[color:var(--border)] bg-[var(--nav-surface)] px-4 py-3 backdrop-blur-xl sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[color:var(--text-primary)]">平台总览控制台</p>
              <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                唯一超级管理员统一管理企业、套餐、订阅和平台配置。
              </p>
            </div>
            <LogoutButton />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
