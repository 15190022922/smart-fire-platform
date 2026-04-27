import { getTenantById } from "./admin-repository";
import { listTenantDevices } from "./devices-repository";
import { getTenantSpatialModelData } from "./spatial-repository";

export async function getPlatformTenantScene(tenantId: string) {
  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    return null;
  }

  const [spatialModel, devices] = await Promise.all([
    getTenantSpatialModelData(tenantId),
    listTenantDevices(tenantId),
  ]);

  return {
    tenant,
    spatialModel,
    devices,
  };
}
