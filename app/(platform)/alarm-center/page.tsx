import { AlarmCenterBoard } from "@/components/alarm-center/alarm-center-board";
import { fetchBackendJson } from "@/lib/backend-client";
import { getServerSession } from "@/lib/server-auth";
import type { AlarmCenterItem } from "@/types/ops";

export default async function AlarmCenterPage() {
  const session = await getServerSession();

  if (!session?.tenantId || session.scope !== "tenant") {
    return null;
  }

  const response = await fetchBackendJson<{ alarms?: AlarmCenterItem[] }>("/api/tenant/alarm-center", { session });
  const payload = response.ok ? await response.json() : {};
  const alarms = Array.isArray(payload.alarms) ? payload.alarms : [];
  return <AlarmCenterBoard initialAlarms={alarms} />;
}
