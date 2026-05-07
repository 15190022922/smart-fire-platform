import type { Metadata } from "next";
import Script from "next/script";
import { cookies } from "next/headers";
import { SaaSDemoProvider } from "@/components/saas/saas-demo-provider";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { ToastProvider } from "@/components/ui/toast-center";
import { fetchBackendJson } from "@/lib/backend-client";
import { getServerSession } from "@/lib/server-auth";
import { getThemeBootstrapScript, normalizeThemePreference, THEME_COOKIE_NAME } from "@/lib/theme";
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
  const cookieStore = await cookies();
  const initialTheme = normalizeThemePreference(cookieStore.get(THEME_COOKIE_NAME)?.value);

  try {
    if (session?.scope === "platform") {
      const response = await fetchBackendJson("/api/admin/state", { session });
      initialAdminState = response.ok ? await response.json() : null;
    }
  } catch {
    initialAdminState = null;
  }

  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
      data-theme={initialTheme}
      suppressHydrationWarning
    >
      <body className="min-h-full font-sans text-[color:var(--text-primary)]">
        <ToastProvider>
          <ConfirmDialogProvider>
            <SaaSDemoProvider initialAdminState={initialAdminState}>{children}</SaaSDemoProvider>
          </ConfirmDialogProvider>
        </ToastProvider>
        <Script
          id="smart-fire-theme-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: getThemeBootstrapScript() }}
        />
      </body>
    </html>
  );
}
