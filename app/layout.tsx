import type { Metadata } from "next";
import { SaaSDemoProvider } from "@/components/saas/saas-demo-provider";
import { fetchBackendJson } from "@/lib/backend-client";
import { getServerSession } from "@/lib/server-auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "智慧消防平台",
  description: "智慧消防报警可视化平台前端静态演示版",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let initialAdminState = null;
  const session = await getServerSession();

  try {
    if (session?.scope === "platform") {
      const response = await fetchBackendJson("/api/admin/state", { session });
      initialAdminState = response.ok ? await response.json() : null;
    }
  } catch {
    initialAdminState = null;
  }

  return (
    <html lang="zh-CN" className="h-full antialiased" data-theme="light">
      <body className="min-h-full font-sans text-[color:var(--text-primary)]">
        <SaaSDemoProvider initialAdminState={initialAdminState}>{children}</SaaSDemoProvider>
      </body>
    </html>
  );
}
