import Link from "next/link";
import { getServerSession } from "@/lib/server-auth";
import { getTenantOverview } from "@/lib/db";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { LogoutButton } from "@/components/layout/logout-button";

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
    session?.scope === "tenant" && session.tenantId ? await getTenantOverview(session.tenantId) : null;

  return (
    <header className="border-b border-[color:var(--border)] bg-[var(--nav-surface)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1880px] flex-col gap-3 px-3 py-3 sm:px-4 lg:px-5">
        <div className="flex items-start justify-between gap-3">
          <Link href="/" className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-sm font-semibold text-rose-600">
              消防
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[color:var(--text-primary)] sm:text-base">
                {session?.tenantName ?? "智慧消防平台"}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[11px] text-[color:var(--text-muted)] sm:truncate sm:text-xs">
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
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700 sm:hidden">
            <span className="truncate">
              {tenantOverview.plan?.name ?? "未分配套餐"} / {tenantOverview.subscription.status}
            </span>
            <Link href="/subscription" className="shrink-0 rounded-full border border-emerald-300 px-2.5 py-1">
              订阅
            </Link>
          </div>
        ) : null}
      </div>

      <div className="mx-auto hidden w-full max-w-[1880px] gap-6 px-3 pb-3 sm:px-4 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {primaryNavigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full border border-transparent bg-[var(--surface-strong)] px-3 py-1.5 text-sm text-[color:var(--text-secondary)] transition hover:border-[color:var(--border)] hover:bg-[var(--surface-muted)] hover:text-[color:var(--text-primary)]"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {tenantOverview?.subscription ? (
            <Link
              href="/subscription"
              className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700"
            >
              {tenantOverview.plan?.name ?? "未分配套餐"} / {tenantOverview.subscription.status}
            </Link>
          ) : null}

          {secondaryNavigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full border border-transparent px-3 py-1.5 text-sm text-[color:var(--text-secondary)] transition hover:border-[color:var(--border)] hover:bg-[var(--surface-strong)] hover:text-[color:var(--text-primary)]"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1880px] gap-2 overflow-x-auto px-3 pb-3 sm:px-4 lg:hidden lg:px-5">
        {mobileNavigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="shrink-0 rounded-full border border-[color:var(--border)] bg-[var(--surface-strong)] px-3 py-2 text-[13px] text-[color:var(--text-secondary)]"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
