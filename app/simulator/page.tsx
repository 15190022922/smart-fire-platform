import { getServerSession } from "@/lib/server-auth";
import { getAdminState, getTenantOverview, getTenantSpatialModel } from "@/lib/db";
import { DeviceSimulatorConsole } from "@/components/simulator/device-simulator-console";

export default async function SimulatorPage() {
  const session = await getServerSession();

  if (!session || session.scope !== "platform") {
    return null;
  }

  const adminState = await getAdminState();
  const initialTenant = adminState.tenants[0] ?? null;

  let initialScene = null;
  if (initialTenant) {
    const [overview, spatialModel] = await Promise.all([
      getTenantOverview(initialTenant.id),
      getTenantSpatialModel(initialTenant.id),
    ]);
    initialScene = {
      tenant: initialTenant,
      spatialModel,
      devices: overview.devices,
    };
  }

  return <DeviceSimulatorConsole tenants={adminState.tenants} initialScene={initialScene} />;
}
