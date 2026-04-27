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
          ? "sf-button sf-button-secondary px-3 py-1.5 text-sm"
          : "sf-button sf-button-secondary px-4 py-2 text-sm"
      }
    >
      退出登录
    </button>
  );
}
