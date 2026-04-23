import { getServerSession } from "@/lib/server-auth";
import { getTenantSpatialModel, listTenantDevices } from "@/lib/db";
import { SpatialModelBoard } from "@/components/spaces/spatial-model-board";

export default async function SpacesPage() {
  const session = await getServerSession();

  if (!session?.tenantId || session.scope !== "tenant") {
    return null;
  }

  const model = await getTenantSpatialModel(session.tenantId);
  const devices = await listTenantDevices(session.tenantId);

  return <SpatialModelBoard initialModel={model} devices={devices} />;
}
