import Link from "next/link";
import { getServerSession } from "@/lib/server-auth";
import { fetchBackendJson } from "@/lib/backend-client";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { LogoutButton } from "@/components/layout/logout-button";
import type { PlanRecord, SubscriptionRecord } from "@/types/saas";

const navigation = [
  { href: "/", label: "\u53ef\u89c6\u5316", widthClass: "lg:col-[span_9/span_9]" },
  { href: "/alarm-center", label: "\u62a5\u8b66\u4e2d\u5fc3", widthClass: "lg:col-[span_11/span_11]" },
  { href: "/duty-center", label: "\u503c\u73ed", widthClass: "lg:col-[span_7/span_7]" },
  { href: "/inspection", label: "\u5de1\u68c0\u7ef4\u4fdd", widthClass: "lg:col-[span_11/span_11]" },
  { href: "/notification-center", label: "\u901a\u77e5\u4e2d\u5fc3", widthClass: "lg:col-[span_11/span_11]" },
  { href: "/devices", label: "\u8bbe\u5907", widthClass: "lg:col-[span_7/span_7]" },
  { href: "/spaces", label: "\u7a7a\u95f4", widthClass: "lg:col-[span_7/span_7]" },
  { href: "/users", label: "\u7528\u6237", widthClass: "lg:col-[span_7/span_7]" },
  { href: "/history", label: "\u5206\u6790", widthClass: "lg:col-[span_7/span_7]" },
  { href: "/audit-log", label: "\u5ba1\u8ba1", widthClass: "lg:col-[span_7/span_7]" },
  { href: "/system-health", label: "\u7cfb\u7edf\u5065\u5eb7", widthClass: "lg:col-[span_11/span_11]" },
  { href: "/settings", label: "\u8bbe\u7f6e", widthClass: "lg:col-[span_7/span_7]" },
];

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
    <header className="relative z-[80] overflow-visible border-b border-[color:var(--border-soft)] bg-[var(--nav-surface)] shadow-[0_1px_0_rgba(255,255,255,0.08),0_16px_42px_rgba(0,0,0,0.22)]">
      <div className="flex w-full flex-col gap-2 px-3 py-2 sm:px-3.5 lg:h-[70px] lg:flex-row lg:items-center lg:gap-3 lg:px-4">
        <Link href="/" className="group flex min-w-0 shrink-0 items-center gap-3 rounded-[18px] border border-[color:var(--border-soft)] bg-[var(--nav-pill)] px-2.5 py-1.5 shadow-[var(--panel-inset)] backdrop-blur-xl lg:w-[292px]">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[15px] border border-[rgba(213,93,104,0.34)] bg-[linear-gradient(135deg,var(--danger-soft),var(--accent-soft),var(--nav-pill))] text-[13px] font-black text-[var(--danger-strong)] shadow-[0_0_24px_rgba(213,93,104,0.13),var(--panel-inset)] backdrop-blur-xl">
            <span className="pointer-events-none absolute inset-x-1 top-0 h-px bg-white/30" />
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

        <nav className="relative grid min-w-0 flex-1 grid-cols-4 items-stretch overflow-hidden rounded-[22px] border border-[color:var(--border-soft)] bg-[var(--nav-pill)] p-0 shadow-[var(--panel-inset)] backdrop-blur-xl md:grid-cols-6 lg:h-12 lg:grid-cols-[repeat(102,minmax(0,1fr))]">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[var(--glass-highlight)]" />
          {navigation.map((item, index) => (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex h-12 min-w-0 items-center justify-center overflow-hidden px-1.5 text-[12px] font-semibold tracking-[-0.01em] text-[color:var(--text-secondary)] transition hover:bg-[var(--accent-soft)] hover:text-[color:var(--text-primary)] lg:text-[13px] ${item.widthClass} ${
                index === navigation.length - 1 ? "" : "border-r border-[color:var(--border-soft)]"
              }`}
            >
              <span className="pointer-events-none absolute inset-x-2 top-0 h-px bg-[var(--glass-highlight)]" />
              <span className="pointer-events-none absolute inset-y-2 left-0 hidden w-px bg-[color:var(--border-soft)] lg:block" />
              <span className="sf-pulse-dot mr-1.5 hidden h-1.5 w-1.5 rounded-full bg-[var(--accent)] lg:inline-block" />
              <span className="relative z-10 whitespace-nowrap">{item.label}</span>
              <span className="pointer-events-none absolute bottom-0 left-1/2 h-[2px] w-0 -translate-x-1/2 rounded-full bg-[var(--accent)] shadow-[0_0_10px_color-mix(in_srgb,var(--accent)_60%,transparent)] transition-all duration-150 group-hover:w-8" />
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center justify-between gap-2 rounded-[18px] border border-[color:var(--border-soft)] bg-[var(--nav-pill)] px-2 py-1.5 shadow-[var(--panel-inset)] backdrop-blur-xl lg:w-[282px] lg:justify-end">
          {tenantOverview?.subscription ? (
            <Link
              href="/subscription"
              className="hidden truncate rounded-full border border-[color:var(--border-soft)] bg-[var(--control-bg-muted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--success-strong)] shadow-[var(--panel-inset)] backdrop-blur-xl 2xl:block"
            >
              {tenantOverview.plan?.name ?? "\u672a\u5206\u914d"} / {tenantOverview.subscription.status}
            </Link>
          ) : null}
          <ThemeSwitcher />
          <LogoutButton compact />
        </div>
      </div>
    </header>
  );
}
