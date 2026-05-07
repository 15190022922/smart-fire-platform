"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export type TenantNavigationLink = {
  type: "link";
  href: string;
  label: string;
};

export type TenantNavigationGroup = {
  type: "group";
  id: string;
  label: string;
  children: TenantNavigationLink[];
};

export type TenantNavigationItem = TenantNavigationLink | TenantNavigationGroup;

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function itemIsActive(pathname: string, item: TenantNavigationItem) {
  if (item.type === "link") {
    return isActivePath(pathname, item.href);
  }

  return item.children.some((child) => isActivePath(pathname, child.href));
}

const navItemBaseClass =
  "group relative flex h-12 min-w-0 items-center justify-center overflow-hidden px-2 text-[12px] font-semibold tracking-[-0.01em] transition hover:bg-[var(--accent-soft)] hover:text-[color:var(--text-primary)] lg:text-[13px]";

function ActiveUnderline({ active }: { active: boolean }) {
  return (
    <>
      <span className="pointer-events-none absolute inset-x-2 top-0 h-px bg-[var(--glass-highlight)]" />
      <span className="pointer-events-none absolute inset-y-2 left-0 hidden w-px bg-[color:var(--border-soft)] lg:block" />
      <span
        className={cn(
          "pointer-events-none absolute bottom-0 left-1/2 h-[2px] -translate-x-1/2 rounded-full bg-[var(--accent)] shadow-[0_0_10px_color-mix(in_srgb,var(--accent)_60%,transparent)] transition-all duration-150 group-hover:w-8",
          active ? "w-8" : "w-0",
        )}
      />
    </>
  );
}

export function TenantNavigationMenu({ items }: { items: TenantNavigationItem[] }) {
  const pathname = usePathname();
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setOpenGroupId(null));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenGroupId(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenGroupId(null);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <nav
      ref={rootRef}
      className="relative grid min-w-0 flex-1 grid-cols-4 items-stretch rounded-[22px] border border-[color:var(--border-soft)] bg-[var(--nav-pill)] p-0 shadow-[var(--panel-inset)] backdrop-blur-xl md:grid-cols-8 lg:h-12 lg:grid-cols-8"
      aria-label="企业端主导航"
    >
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[var(--glass-highlight)]" />
      {items.map((item, index) => {
        const active = itemIsActive(pathname, item);
        const borderClass = index === items.length - 1 ? "" : "border-r border-[color:var(--border-soft)]";

        if (item.type === "link") {
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpenGroupId(null)}
              className={cn(navItemBaseClass, borderClass, active ? "text-[color:var(--text-primary)]" : "text-[color:var(--text-secondary)]")}
            >
              <ActiveUnderline active={active} />
              <span className={cn("sf-pulse-dot mr-1.5 hidden h-1.5 w-1.5 rounded-full bg-[var(--accent)] lg:inline-block", active ? "opacity-100" : "opacity-70")} />
              <span className="relative z-10 whitespace-nowrap">{item.label}</span>
            </Link>
          );
        }

        const open = openGroupId === item.id;

        return (
          <div key={item.id} className={cn("relative min-w-0", borderClass)}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpenGroupId((current) => (current === item.id ? null : item.id))}
              className={cn(
                navItemBaseClass,
                "w-full",
                active || open ? "text-[color:var(--text-primary)]" : "text-[color:var(--text-secondary)]",
              )}
            >
              <ActiveUnderline active={active || open} />
              <span className={cn("sf-pulse-dot mr-1.5 hidden h-1.5 w-1.5 rounded-full bg-[var(--accent)] lg:inline-block", active ? "opacity-100" : "opacity-70")} />
              <span className="relative z-10 whitespace-nowrap">{item.label}</span>
              <span className={cn("relative z-10 ml-1 text-[10px] transition-transform", open ? "rotate-180" : "")}>v</span>
            </button>

            {open ? (
              <div
                role="menu"
                className="sf-fade-in absolute left-1/2 top-[calc(100%+8px)] z-[130] w-[188px] -translate-x-1/2 rounded-[18px] border border-[color:var(--border)] bg-[var(--surface-strong)] p-2 shadow-[var(--panel-shadow-strong)] backdrop-blur-xl"
              >
                <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[var(--glass-highlight)]" />
                {item.children.map((child) => {
                  const childActive = isActivePath(pathname, child.href);
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      role="menuitem"
                      onClick={() => setOpenGroupId(null)}
                      className={cn(
                        "group/menuitem relative flex items-center justify-between gap-3 rounded-[12px] border px-3 py-2.5 text-sm font-semibold outline-none transition duration-150 focus-visible:border-[color:var(--border-strong)] focus-visible:bg-[var(--accent-soft)] focus-visible:text-[var(--accent-strong)] focus-visible:shadow-[var(--panel-inset)]",
                        childActive
                          ? "border-[color:var(--border-strong)] bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-[var(--panel-inset)]"
                          : "border-transparent text-[color:var(--text-secondary)] hover:-translate-y-[1px] hover:border-[color:var(--border-strong)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)] hover:shadow-[var(--panel-inset)]",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute bottom-2 left-1 top-2 w-0.5 rounded-full bg-[var(--accent)] transition-opacity",
                          childActive ? "opacity-100" : "opacity-0 group-hover/menuitem:opacity-100 group-focus-visible/menuitem:opacity-100",
                        )}
                      />
                      <span>{child.label}</span>
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full bg-[var(--accent)] transition-opacity",
                          childActive ? "opacity-100" : "opacity-0 group-hover/menuitem:opacity-100 group-focus-visible/menuitem:opacity-100",
                        )}
                      />
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
