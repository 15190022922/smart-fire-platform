import { PlatformSessionBridge } from "@/components/auth/tenant-session-bridge";
import { SaaSShell } from "@/components/saas/saas-shell";
import { getServerSessionToken } from "@/lib/server-auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const token = await getServerSessionToken();
  return (
    <>
      <PlatformSessionBridge token={token} />
      <SaaSShell>{children}</SaaSShell>
    </>
  );
}
