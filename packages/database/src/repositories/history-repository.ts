import { assertTenantId } from "../errors";
import { queryDb } from "../client";
import { formatLocalTimestamp, mapAlarm, mapRawDeviceEvent, mapTenantDevice } from "./_shared";

export async function getTenantHistoryData(tenantId: string) {
  assertTenantId(tenantId);
  const [alarms, rawEvents, devices] = await Promise.all([
    queryDb("SELECT * FROM tenant_alarms WHERE tenant_id = $1 ORDER BY time DESC LIMIT 800", [tenantId]),
    queryDb("SELECT * FROM raw_device_events WHERE tenant_id = $1 ORDER BY reported_at DESC LIMIT 1500", [tenantId]),
    queryDb("SELECT * FROM tenant_devices WHERE tenant_id = $1 ORDER BY name ASC", [tenantId]),
  ]);

  return {
    alarms: alarms.rows.map(mapAlarm),
    rawEvents: rawEvents.rows.map(mapRawDeviceEvent),
    devices: devices.rows.map(mapTenantDevice),
    exportedAt: formatLocalTimestamp(),
  };
}
