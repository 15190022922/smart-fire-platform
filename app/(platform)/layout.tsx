import { TopNavigation } from "@/components/layout/top-navigation";
import { TenantSessionBridge } from "@/components/auth/tenant-session-bridge";
import { getServerSessionToken } from "@/lib/server-auth";

export default async function PlatformLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const token = await getServerSessionToken();

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_50%_0%,var(--page-radial)_0%,transparent_36%),radial-gradient(circle_at_10%_82%,var(--page-radial-soft)_0%,transparent_30%),linear-gradient(180deg,var(--page-gradient-top)_0%,var(--page-gradient-bottom)_100%)] xl:h-screen xl:overflow-hidden">
      <TenantSessionBridge token={token} />
      <TopNavigation />
      <main
        className="min-h-0 w-full flex-1 overflow-y-auto px-2.5 pb-2 sm:px-3 lg:px-3"
        style={{ paddingTop: "var(--tenant-main-padding-top, 3px)" }}
      >
        {children}
      </main>
    </div>
  );
}
