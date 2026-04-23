import { notFound } from "next/navigation";
import { HistoryAnalysisBoard } from "@/components/history/history-analysis-board";
import { getServerSession } from "@/lib/server-auth";
import { getTenantHistoryData } from "@/lib/db";

export default async function HistoryPage() {
  const session = await getServerSession();

  if (!session?.tenantId || session.scope !== "tenant") {
    notFound();
  }

  const historyData = await getTenantHistoryData(session.tenantId);
  return <HistoryAnalysisBoard initialData={historyData} />;
}
