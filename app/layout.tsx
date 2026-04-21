import type { Metadata } from "next";
import { SaaSDemoProvider } from "@/components/saas/saas-demo-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "智慧消防平台",
  description: "智慧消防报警可视化平台前端静态演示版",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased" data-theme="light">
      <body className="min-h-full font-sans text-[color:var(--text-primary)]">
        <SaaSDemoProvider>{children}</SaaSDemoProvider>
      </body>
    </html>
  );
}
