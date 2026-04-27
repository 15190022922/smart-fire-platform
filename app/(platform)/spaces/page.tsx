import { getServerSession } from "@/lib/server-auth";
import { fetchBackendJson } from "@/lib/backend-client";
import { SpatialModelBoard } from "@/components/spaces/spatial-model-board";
import type { TenantSpatialModel } from "@/types/hardware";
import type { TenantDeviceRecord } from "@/types/saas";

export default async function SpacesPage() {
  const session = await getServerSession();

  if (!session?.tenantId || session.scope !== "tenant") {
    return null;
  }

  const [spatialResponse, devicesResponse] = await Promise.all([
    fetchBackendJson<TenantSpatialModel>("/api/tenant/spatial-model", { session }),
    fetchBackendJson<{ devices?: TenantDeviceRecord[] }>("/api/tenant/devices", { session }),
  ]);

  const model =
    spatialResponse.ok
      ? await spatialResponse.json()
      : ({
          summary: {
            siteCount: 0,
            buildingCount: 0,
            floorCount: 0,
            drawingCount: 0,
            gatewayCount: 0,
            onlineGatewayCount: 0,
            mappedDeviceCount: 0,
            unmappedDeviceCount: 0,
            recentEventCount: 0,
          },
          sites: [],
          buildings: [],
          floors: [],
          drawings: [],
          gateways: [],
          devicePoints: [],
          statusSnapshots: [],
          recentEvents: [],
        } satisfies TenantSpatialModel);
  const devicesPayload = devicesResponse.ok ? await devicesResponse.json() : {};
  const devices = Array.isArray(devicesPayload.devices) ? devicesPayload.devices : [];

  return <SpatialModelBoard initialModel={model} devices={devices} />;
}
