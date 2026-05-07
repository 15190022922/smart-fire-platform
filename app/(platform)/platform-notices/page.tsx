import { TenantPlatformNoticeBoard } from "@/components/platform-notices/tenant-platform-notice-board";
import { fetchBackendJson } from "@/lib/backend-client";
import { getServerSession } from "@/lib/server-auth";
import type { PlatformNoticeDeliveryRecord } from "@/types/ops";

export default async function PlatformNoticesPage() {
  const session = await getServerSession();

  if (!session?.tenantId || session.scope !== "tenant") {
    return null;
  }

  const response = await fetchBackendJson<{ notices?: PlatformNoticeDeliveryRecord[] }>("/api/tenant/platform-notices", {
    session,
  });
  const payload: { notices?: PlatformNoticeDeliveryRecord[] } = response.ok ? await response.json() : {};
  const notices: PlatformNoticeDeliveryRecord[] = Array.isArray(payload.notices) ? payload.notices : [];

  return <TenantPlatformNoticeBoard notices={notices} />;
}
