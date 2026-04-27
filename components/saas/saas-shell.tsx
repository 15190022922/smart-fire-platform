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
  return status === "启用" || status === "鍚敤" || status === "閸氼垳鏁?";
}

function isActiveSubscription(status?: string | null) {
  return (
    status === "已生效" ||
    status === "试用中" ||
    status === "宸茬敓鏁?" ||
    status === "璇曠敤涓?" ||
    status === "瀹歌尙鏁撻弫?" ||
    status === "鐠囨洜鏁ゆ稉?"
  );
}

export function SaaSShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { tenants, subscriptions, plans } = useSaaSDemo();

  const activeSubscriptions = subscriptions.filter((item) => isActiveSubscription(item.status));
  const activeTenants = tenants.filter((item) => isEnabledStatus(item.status));
  const enterprisePlanCount = plans.length;

  return (
    <div className="flex min-h-screen bg-[linear-gradient(180deg,#f6f9fc_0%,#eef3f8_100%)] xl:h-screen xl:overflow-hidden">
      <aside className="hidden min-h-0 w-72 shrink-0 border-r border-[color:var(--border-soft)] bg-[linear-gradient(180deg,#f8fbfe_0%,#f3f7fb_100%)] px-4 py-4 lg:flex lg:flex-col">
        <div className="relative shrink-0 overflow-hidden rounded-[20px] border border-[color:var(--border)] bg-[var(--surface)] px-4 py-4 shadow-[var(--panel-shadow)]">
          <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(72,106,141,0.18),transparent)]" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[color:var(--text-faint)]">Platform SaaS</p>
          <h1 className="mt-3 text-[1.15rem] font-semibold tracking-[-0.02em] text-[color:var(--text-primary)]">平台管理端</h1>
          <p className="mt-2 text-[13px] leading-6 text-[color:var(--text-muted)]">
            平台端只有一个唯一超级管理员账号，默认拥有全部权限，可统一查看并管理所有企业数据。
          </p>
        </div>

        <div className="mt-4 shrink-0 grid gap-2.5">
          {[
            { label: "启用企业", value: activeTenants.length },
            { label: "有效订阅", value: activeSubscriptions.length },
            { label: "套餐数量", value: enterprisePlanCount },
          ].map((item) => (
            <div
              key={item.label}
              className="sf-panel-subtle px-4 py-3"
            >
              <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--text-faint)]">{item.label}</p>
              <p className="mt-1.5 text-[1.55rem] font-semibold tracking-[-0.02em] text-[color:var(--text-primary)]">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
          <nav className="space-y-1.5">
            {adminNavigationLinks.map((link) => {
              const active = pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center justify-between rounded-[14px] border px-4 py-2.5 text-[13px] font-medium transition",
                    active
                      ? "border-[rgba(72,106,141,0.18)] bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
                      : "border-transparent bg-transparent text-[color:var(--text-secondary)] hover:border-[color:var(--border)] hover:bg-[rgba(255,255,255,0.64)]",
                  )}
                >
                  <span>{link.label}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-faint)]">
                    管理
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="sf-panel-subtle mt-4 px-4 py-4">
            <p className="text-sm font-semibold text-[color:var(--text-primary)]">说明</p>
            <p className="mt-3 text-[13px] leading-6 text-[color:var(--text-secondary)]">
              左侧导航区域现在支持独立滚动。即使后续继续增加菜单和平台工具，也不会再把“我的”下面的内容截断。
            </p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-[color:var(--border-soft)] bg-[rgba(248,251,254,0.9)] px-4 py-2.5 backdrop-blur-xl sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-faint)]">
                Platform Workspace
              </p>
              <p className="mt-1 text-sm font-semibold tracking-[-0.01em] text-[color:var(--text-primary)]">平台总览控制台</p>
              <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                唯一超级管理员统一管理企业、套餐、订阅、模拟测试和平台配置。
              </p>
            </div>
            <LogoutButton />
          </div>
        </header>

        <div className="border-b border-[color:var(--border-soft)] bg-[var(--surface)] px-4 py-2 lg:hidden">
          <nav className="flex gap-2 overflow-x-auto">
            {adminNavigationLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "sf-button shrink-0 rounded-full px-3 py-2 text-[13px] font-medium transition",
                    active
                      ? "border-[rgba(72,106,141,0.18)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                      : "border-[color:var(--border)] bg-[var(--surface-strong)] text-[color:var(--text-secondary)]",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
