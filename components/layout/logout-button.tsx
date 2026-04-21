"use client";

import { useRouter } from "next/navigation";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={
        compact
          ? "rounded-full border border-[color:var(--border)] bg-[var(--surface-strong)] px-3 py-1.5 text-sm text-[color:var(--text-secondary)] transition hover:bg-[var(--surface-muted)]"
          : "rounded-full border border-[color:var(--border)] bg-[var(--surface-strong)] px-4 py-2 text-sm text-[color:var(--text-secondary)] transition hover:bg-[var(--surface-muted)]"
      }
    >
      退出登录
    </button>
  );
}
