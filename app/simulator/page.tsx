import { PlatformSessionBridge } from "@/components/auth/tenant-session-bridge";
import { getServerSession } from "@/lib/server-auth";
import { getServerSessionToken } from "@/lib/server-auth";
import { fetchBackendJson } from "@/lib/backend-client";
import { DeviceSimulatorConsole } from "@/components/simulator/device-simulator-console";
import type { TenantSpatialModel } from "@/types/hardware";
import type { TenantDeviceRecord, TenantRecord } from "@/types/saas";

export default async function SimulatorPage() {
  const session = await getServerSession();
  const token = await getServerSessionToken();

  if (!session || session.scope !== "platform") {
    return null;
  }

  const overviewResponse = await fetchBackendJson<{ tenants?: TenantRecord[] }>("/api/platform/overview", { session });
  const overview = overviewResponse.ok ? await overviewResponse.json() : {};
  const tenants = Array.isArray(overview.tenants) ? overview.tenants : [];
  const initialTenant = tenants[0] ?? null;

  let initialScene = null;
  if (initialTenant) {
    const sceneResponse = await fetchBackendJson<{
      tenant: TenantRecord;
      spatialModel: TenantSpatialModel;
      devices: TenantDeviceRecord[];
    }>(`/api/platform/tenant-scene?tenantId=${encodeURIComponent(initialTenant.id)}`, { session });
    initialScene = sceneResponse.ok ? await sceneResponse.json() : null;
  }

  return (
    <>
      <PlatformSessionBridge token={token} />
      <DeviceSimulatorConsole tenants={tenants} initialScene={initialScene} />
    </>
  );
}
