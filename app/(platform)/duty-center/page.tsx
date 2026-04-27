import { DutyCenterBoard } from "@/components/duty/duty-center-board";
import { fetchBackendJson } from "@/lib/backend-client";
import { getServerSession } from "@/lib/server-auth";
import type { DutyCenterPayload } from "@/types/duty";

export default async function DutyCenterPage() {
  const session = await getServerSession();
  let initialData: DutyCenterPayload | null = null;

  if (session?.tenantId) {
    const response = await fetchBackendJson<DutyCenterPayload>("/api/tenant/duty-center", {
      method: "GET",
      session,
    });
    if (response.ok) {
      initialData = await response.json();
    }
  }

  return <DutyCenterBoard initialData={initialData} />;
}
