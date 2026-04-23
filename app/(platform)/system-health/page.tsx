import { SystemHealthBoard } from "@/components/system-health/system-health-board";
import { fetchBackendJson } from "@/lib/backend-client";
import { getServerSession } from "@/lib/server-auth";
import type { SystemHealthPayload } from "@/types/ops";

const EMPTY_SYSTEM_HEALTH: SystemHealthPayload = {
  generatedAt: "",
  metrics: [],
  recentErrors: [],
  latestEvents: [],
};

export default async function SystemHealthPage() {
  const session = await getServerSession();

  if (!session?.tenantId || session.scope !== "tenant") {
    return null;
  }

  const response = await fetchBackendJson<Partial<SystemHealthPayload>>("/api/tenant/system-health", { session });
  const payload = response.ok ? await response.json() : {};
  const initialData: SystemHealthPayload = {
    generatedAt: typeof payload.generatedAt === "string" ? payload.generatedAt : EMPTY_SYSTEM_HEALTH.generatedAt,
    metrics: Array.isArray(payload.metrics) ? payload.metrics : EMPTY_SYSTEM_HEALTH.metrics,
    recentErrors: Array.isArray(payload.recentErrors) ? payload.recentErrors : EMPTY_SYSTEM_HEALTH.recentErrors,
    latestEvents: Array.isArray(payload.latestEvents) ? payload.latestEvents : EMPTY_SYSTEM_HEALTH.latestEvents,
  };
  return <SystemHealthBoard initialData={initialData} />;
}
