import { PlatformNoticeManager } from "@/components/saas/admin/platform-notice-manager";
import { fetchBackendJson } from "@/lib/backend-client";
import { getServerSession } from "@/lib/server-auth";
import type { PlatformNoticeRecord } from "@/types/ops";

export default async function AdminPlatformNoticesPage() {
  const session = await getServerSession();
  const response =
    session?.scope === "platform"
      ? await fetchBackendJson<{ notices?: PlatformNoticeRecord[] }>("/api/admin/platform-notices", { session })
      : null;
  const payload = response?.ok ? await response.json() : {};

  return <PlatformNoticeManager initialNotices={Array.isArray(payload.notices) ? payload.notices : []} />;
}
