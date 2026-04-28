import { getTenantById } from "./admin-repository";
import { listTenantAlarmCenterData } from "./alarms-repository";
import { listTenantDevices } from "./devices-repository";
import { getTenantNotificationCenterData } from "./notification-repository";
import { getTenantSpatialModelData } from "./spatial-repository";

export async function getPlatformTenantScene(tenantId: string) {
  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    return null;
  }

  const [spatialModel, devices, alarms, notificationCenter] = await Promise.all([
    getTenantSpatialModelData(tenantId),
    listTenantDevices(tenantId),
    listTenantAlarmCenterData(tenantId),
    getTenantNotificationCenterData(tenantId),
  ]);

  return {
    tenant,
    spatialModel,
    devices,
    alarms,
    notificationRecords: notificationCenter.records,
  };
}
