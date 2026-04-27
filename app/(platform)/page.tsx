import { getServerSession } from "@/lib/server-auth";
import { fetchBackendJson } from "@/lib/backend-client";
import { LiveVisualizationPage, type TenantOverviewPayload } from "@/components/dashboard/live-visualization-page";
import type { TenantSpatialModel } from "@/types/hardware";
import type { AlarmCenterItem } from "@/types/ops";

export default async function VisualizationPage() {
  const session = await getServerSession();

  if (!session?.tenantId || session.scope !== "tenant") {
    return null;
  }

  const [overviewResponse, spatialModelResponse, alarmCenterResponse] = await Promise.all([
    fetchBackendJson<Partial<TenantOverviewPayload>>("/api/tenant/overview", { session }),
    fetchBackendJson<TenantSpatialModel>("/api/tenant/spatial-model", { session }),
    fetchBackendJson<{ alarms?: AlarmCenterItem[] }>("/api/tenant/alarm-center", { session }),
  ]);

  const overviewPayload = overviewResponse.ok ? await overviewResponse.json() : {};
  const spatialPayload = spatialModelResponse.ok ? await spatialModelResponse.json() : null;
  const alarmCenterPayload = alarmCenterResponse.ok ? await alarmCenterResponse.json() : {};

  const overview: TenantOverviewPayload = {
    devices: Array.isArray(overviewPayload.devices) ? overviewPayload.devices : [],
    alarms: Array.isArray(overviewPayload.alarms) ? overviewPayload.alarms : [],
  };

  const spatialModel: TenantSpatialModel =
    spatialPayload ??
    ({
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

  return (
    <LiveVisualizationPage
      initialOverview={overview}
      initialSpatialModel={spatialModel}
      initialAlarmCenterItems={Array.isArray(alarmCenterPayload.alarms) ? alarmCenterPayload.alarms : []}
    />
  );
}
