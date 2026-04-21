import Link from "next/link";
import { getServerSession } from "@/lib/server-auth";
import { getTenantOverview } from "@/lib/db";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { LogoutButton } from "@/components/layout/logout-button";

const enterpriseNavigation = [
  { href: "/", label: "可视化主页面" },
  { href: "/devices", label: "设备管理" },
  { href: "/users", label: "用户管理" },
  { href: "/settings", label: "系统设置" },
  { href: "/subscription", label: "订阅服务" },
];

export async function TopNavigation() {
  const session = await getServerSession();
  const tenantOverview =
    session?.scope === "tenant" && session.tenantId ? await getTenantOverview(session.tenantId) : null;

  return (
    <header className="border-b border-[color:var(--border)] bg-[var(--nav-surface)] backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] w-full max-w-[1880px] items-center justify-between gap-4 px-3 sm:px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-sm font-semibold text-rose-600">
              消防
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                {session?.tenantName ?? "智慧消防平台"}
              </p>
              <p className="truncate text-xs text-[color:var(--text-muted)]">
                {tenantOverview?.plan?.name ?? "企业控制台"}
                {tenantOverview?.subscription ? ` · ${tenantOverview.subscription.status}` : ""}
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 lg:flex">
            {enterpriseNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-transparent px-4 py-2 text-sm text-[color:var(--text-secondary)] transition hover:border-[color:var(--border)] hover:bg-[var(--surface-strong)] hover:text-[color:var(--text-primary)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {tenantOverview?.subscription ? (
            <Link
              href="/subscription"
              className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700 md:inline-flex"
            >
              {tenantOverview.plan?.name ?? "未分配套餐"} / {tenantOverview.subscription.status}
            </Link>
          ) : null}
          <ThemeSwitcher />
          <LogoutButton compact />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1880px] gap-2 overflow-x-auto px-3 pb-3 lg:hidden sm:px-4 lg:px-6">
        {enterpriseNavigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="shrink-0 rounded-full border border-[color:var(--border)] bg-[var(--surface-strong)] px-4 py-2 text-sm text-[color:var(--text-secondary)]"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
