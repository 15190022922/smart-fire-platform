import { InspectionBoard } from "@/components/inspection/inspection-board";
import { fetchBackendJson } from "@/lib/backend-client";
import { getServerSession } from "@/lib/server-auth";
import type { InspectionCenterPayload } from "@/types/inspection";

export default async function InspectionPage() {
  const session = await getServerSession();
  let initialData: InspectionCenterPayload | null = null;

  if (session?.tenantId) {
    const response = await fetchBackendJson<InspectionCenterPayload>("/api/tenant/inspection", {
      method: "GET",
      session,
    });
    if (response.ok) {
      initialData = await response.json();
    }
  }

  return <InspectionBoard initialData={initialData} />;
}
