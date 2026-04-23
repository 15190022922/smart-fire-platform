import { AuditLogBoard } from "@/components/audit/audit-log-board";
import { fetchBackendJson } from "@/lib/backend-client";
import { getServerSession } from "@/lib/server-auth";
import type { AuditLogRecord } from "@/types/ops";

export default async function AuditLogPage() {
  const session = await getServerSession();

  if (!session?.tenantId || session.scope !== "tenant") {
    return null;
  }

  const response = await fetchBackendJson<{ logs?: AuditLogRecord[] }>("/api/tenant/audit-log", { session });
  const payload = response.ok ? await response.json() : {};
  const logs = Array.isArray(payload.logs) ? payload.logs : [];
  return <AuditLogBoard logs={logs} />;
}
