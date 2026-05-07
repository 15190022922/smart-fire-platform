import Link from "next/link";
import { cookies } from "next/headers";
import { getServerSession } from "@/lib/server-auth";
import { fetchBackendJson } from "@/lib/backend-client";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { LogoutButton } from "@/components/layout/logout-button";
import { TenantNavigationMenu, type TenantNavigationItem } from "@/components/layout/tenant-navigation-menu";
import { normalizeThemePreference, THEME_COOKIE_NAME } from "@/lib/theme";
import type { PlanRecord, SubscriptionRecord } from "@/types/saas";

const navigation: TenantNavigationItem[] = [
  { type: "link", href: "/", label: "可视化" },
  { type: "link", href: "/alarm-center", label: "报警中心" },
  { type: "link", href: "/duty-center", label: "值班中心" },
  { type: "link", href: "/inspection", label: "巡检维保" },
  { type: "link", href: "/platform-notices", label: "平台通知" },
  {
    type: "group",
    id: "management",
    label: "管理中心",
    children: [
      { type: "link", href: "/notification-center", label: "通知管理" },
      { type: "link", href: "/devices", label: "设备管理" },
      { type: "link", href: "/spaces", label: "图纸管理" },
      { type: "link", href: "/users", label: "用户管理" },
    ],
  },
  { type: "link", href: "/history", label: "数据分析" },
  {
    type: "group",
    id: "system",
    label: "系统",
    children: [
      { type: "link", href: "/audit-log", label: "审计日志" },
      { type: "link", href: "/system-health", label: "系统监控" },
      { type: "link", href: "/settings", label: "设置" },
    ],
  },
];

export async function TopNavigation() {
  const session = await getServerSession();
  const initialTheme = normalizeThemePreference((await cookies()).get(THEME_COOKIE_NAME)?.value);
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
    <header className="relative z-[80] overflow-visible border-b border-[color:var(--border-soft)] bg-[var(--nav-surface)] shadow-[var(--panel-shadow)]">
      <div className="flex w-full flex-col gap-2 px-3 py-2 sm:px-3.5 lg:h-[70px] lg:flex-row lg:items-center lg:gap-3 lg:px-4">
        <Link href="/" className="group flex min-w-0 items-center gap-3 rounded-[18px] border border-[color:var(--border-soft)] bg-[var(--nav-pill)] px-2.5 py-1.5 shadow-[var(--panel-inset)] backdrop-blur-xl lg:min-w-[180px] lg:max-w-[260px] lg:shrink">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[15px] border border-[color:var(--border-soft)] bg-[linear-gradient(135deg,var(--danger-soft),var(--accent-soft),var(--nav-pill))] text-[13px] font-black text-[var(--danger-strong)] shadow-[var(--panel-inset)] backdrop-blur-xl">
            <span className="pointer-events-none absolute inset-x-1 top-0 h-px bg-[var(--glass-highlight)]" />
            <span className="pointer-events-none absolute bottom-1 left-1 right-1 h-px bg-[var(--accent-soft)]" />
            {"\u6d88\u9632"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[18px] font-semibold leading-tight tracking-[-0.02em] text-[color:var(--text-primary)]">
              {session?.tenantName ?? "\u667a\u6167\u6d88\u9632\u5e73\u53f0"}
            </p>
            <p className="mt-0.5 truncate text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
              {tenantOverview?.plan?.name ?? "\u4f01\u4e1a\u63a7\u5236\u53f0"}
              {tenantOverview?.subscription ? ` / ${tenantOverview.subscription.status}` : ""}
            </p>
          </div>
        </Link>

        <TenantNavigationMenu items={navigation} />

        <div className="flex shrink-0 items-center justify-between gap-2 rounded-[18px] border border-[color:var(--border-soft)] bg-[var(--nav-pill)] px-2 py-1.5 shadow-[var(--panel-inset)] backdrop-blur-xl lg:w-auto lg:justify-end">
          {tenantOverview?.subscription ? (
            <Link
              href="/subscription"
              className="hidden truncate rounded-full border border-[color:var(--border-soft)] bg-[var(--control-bg-muted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--success-strong)] shadow-[var(--panel-inset)] backdrop-blur-xl 2xl:block"
            >
              {tenantOverview.plan?.name ?? "\u672a\u5206\u914d"} / {tenantOverview.subscription.status}
            </Link>
          ) : null}
          <ThemeSwitcher initialTheme={initialTheme} />
          <LogoutButton compact />
        </div>
      </div>
    </header>
  );
}
