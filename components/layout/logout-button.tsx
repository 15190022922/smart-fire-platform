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
          ? "sf-button sf-button-secondary h-9 whitespace-nowrap px-3 text-sm leading-none"
          : "sf-button sf-button-secondary whitespace-nowrap px-4 py-2 text-sm leading-none"
      }
    >
      退出登录
    </button>
  );
}
