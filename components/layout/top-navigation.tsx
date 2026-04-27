import Link from "next/link";
import { getServerSession } from "@/lib/server-auth";
import { fetchBackendJson } from "@/lib/backend-client";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { LogoutButton } from "@/components/layout/logout-button";
import type { PlanRecord, SubscriptionRecord } from "@/types/saas";

const primaryNavigation = [
  { href: "/", label: "可视化主页面" },
  { href: "/alarm-center", label: "报警中心" },
  { href: "/duty-center", label: "值班中心" },
  { href: "/inspection", label: "巡检维保" },
  { href: "/notification-center", label: "通知中心" },
  { href: "/devices", label: "设备管理" },
  { href: "/spaces", label: "空间建模" },
];

const secondaryNavigation = [
  { href: "/users", label: "用户管理" },
  { href: "/history", label: "数据分析" },
  { href: "/audit-log", label: "审计日志" },
  { href: "/system-health", label: "系统健康" },
  { href: "/settings", label: "系统设置" },
  { href: "/subscription", label: "订阅服务" },
  { href: "/profile", label: "我的" },
];

const mobileNavigation = [...primaryNavigation, ...secondaryNavigation];

export async function TopNavigation() {
  const session = await getServerSession();
  const tenantOverview =
    session?.scope === "tenant" && session.tenantId
      ? await fetchBackendJson<{ plan?: PlanRecord | null; subscription?: SubscriptionRecord | null }>(
          "/api/tenant/overview",
          { session },
        )
          .then(async (response) => (response.ok ? response.json() : null))
          .catch(() => null)
      : null;

  return (
    <header className="relative z-[80] border-b border-[color:var(--border-soft)] bg-[var(--nav-surface)] shadow-[0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1880px] flex-col gap-2.5 px-3 py-2.5 sm:px-4 lg:px-5">
        <div className="flex items-start justify-between gap-3">
          <Link href="/" className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] border border-[rgba(176,72,79,0.16)] bg-[var(--danger-soft)] text-sm font-semibold text-[var(--danger-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
              消防
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold tracking-[-0.015em] text-[color:var(--text-primary)] sm:text-[16px]">
                {session?.tenantName ?? "智慧消防平台"}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[11px] text-[color:var(--text-muted)] sm:truncate sm:text-[12px]">
                {tenantOverview?.plan?.name ?? "企业控制台"}
                {tenantOverview?.subscription ? ` / ${tenantOverview.subscription.status}` : ""}
              </p>
            </div>
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            <ThemeSwitcher />
            <LogoutButton compact />
          </div>
        </div>

        {tenantOverview?.subscription ? (
          <div className="flex items-center justify-between gap-2 rounded-[14px] border border-[rgba(57,118,91,0.16)] bg-[var(--success-soft)] px-3 py-2 text-[11px] text-[var(--success-strong)] sm:hidden">
            <span className="truncate">
              {tenantOverview.plan?.name ?? "未分配套餐"} / {tenantOverview.subscription.status}
            </span>
            <Link href="/subscription" className="sf-button sf-button-secondary shrink-0 px-2.5 py-1 text-[11px]">
              订阅
            </Link>
          </div>
        ) : null}
      </div>

      <div className="mx-auto hidden w-full max-w-[1880px] gap-5 px-3 pb-2.5 sm:px-4 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {primaryNavigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="sf-button rounded-full border border-[color:var(--border-soft)] bg-[var(--nav-pill)] px-3 py-[5px] text-[14px] font-semibold tracking-[-0.01em] text-[color:var(--text-secondary)] hover:border-[color:var(--border)] hover:bg-[var(--surface-strong)] hover:text-[color:var(--text-primary)]"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {tenantOverview?.subscription ? (
            <Link
              href="/subscription"
              className="sf-button rounded-full border border-[rgba(57,118,91,0.16)] bg-[var(--success-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--success-strong)]"
            >
              {tenantOverview.plan?.name ?? "未分配套餐"} / {tenantOverview.subscription.status}
            </Link>
          ) : null}

          {secondaryNavigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="sf-button rounded-full border border-[color:var(--border-soft)] bg-[var(--nav-pill)] px-3 py-[5px] text-[14px] font-semibold tracking-[-0.01em] text-[color:var(--text-secondary)] hover:border-[color:var(--border)] hover:bg-[var(--surface-strong)] hover:text-[color:var(--text-primary)]"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1880px] gap-1.5 overflow-x-auto px-3 pb-2.5 sm:px-4 lg:hidden lg:px-5">
        {mobileNavigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="sf-button sf-button-secondary shrink-0 px-3 py-1.5 text-[14px] font-semibold tracking-[-0.01em]"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
