import { notFound } from "next/navigation";
import { HistoryAnalysisBoard } from "@/components/history/history-analysis-board";
import { fetchBackendJson } from "@/lib/backend-client";
import { getServerSession } from "@/lib/server-auth";
import type { RawDeviceEventRecord } from "@/types/hardware";
import type { AlarmRecord } from "@/types/platform";
import type { TenantDeviceRecord } from "@/types/saas";

export default async function HistoryPage() {
  const session = await getServerSession();

  if (!session?.tenantId || session.scope !== "tenant") {
    notFound();
  }

  const historyResponse = await fetchBackendJson<{
    alarms?: AlarmRecord[];
    rawEvents?: RawDeviceEventRecord[];
    devices?: TenantDeviceRecord[];
    exportedAt?: string;
  }>("/api/tenant/history", { session });
  const historyPayload = historyResponse.ok ? await historyResponse.json() : {};
  const historyData = {
    alarms: Array.isArray(historyPayload.alarms) ? historyPayload.alarms : [],
    rawEvents: Array.isArray(historyPayload.rawEvents) ? historyPayload.rawEvents : [],
    devices: Array.isArray(historyPayload.devices) ? historyPayload.devices : [],
    exportedAt: historyPayload.exportedAt ?? "",
  };
  return <HistoryAnalysisBoard initialData={historyData} />;
}
