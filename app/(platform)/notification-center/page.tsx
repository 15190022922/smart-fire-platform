import { NotificationCenterBoard } from "@/components/notification/notification-center-board";
import { fetchBackendJson } from "@/lib/backend-client";
import { getServerSession } from "@/lib/server-auth";
import type { NotificationRecord, NotificationTemplateRecord } from "@/types/ops";

export default async function NotificationCenterPage() {
  const session = await getServerSession();

  if (!session?.tenantId || session.scope !== "tenant") {
    return null;
  }

  const response = await fetchBackendJson<{
    templates?: NotificationTemplateRecord[];
    records?: NotificationRecord[];
  }>("/api/tenant/notification-center", { session });
  const payload = response.ok ? await response.json() : {};

  return (
    <NotificationCenterBoard
      initialTemplates={Array.isArray(payload.templates) ? payload.templates : []}
      initialRecords={Array.isArray(payload.records) ? payload.records : []}
    />
  );
}
