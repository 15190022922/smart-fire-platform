"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTenantHistoryData = getTenantHistoryData;
const errors_1 = require("../errors");
const client_1 = require("../client");
const _shared_1 = require("./_shared");
async function getTenantHistoryData(tenantId) {
    (0, errors_1.assertTenantId)(tenantId);
    const [alarms, rawEvents, devices] = await Promise.all([
        (0, client_1.queryDb)("SELECT * FROM tenant_alarms WHERE tenant_id = $1 ORDER BY time DESC LIMIT 800", [tenantId]),
        (0, client_1.queryDb)("SELECT * FROM raw_device_events WHERE tenant_id = $1 ORDER BY reported_at DESC LIMIT 1500", [tenantId]),
        (0, client_1.queryDb)("SELECT * FROM tenant_devices WHERE tenant_id = $1 ORDER BY name ASC", [tenantId]),
    ]);
    return {
        alarms: alarms.rows.map(_shared_1.mapAlarm),
        rawEvents: rawEvents.rows.map(_shared_1.mapRawDeviceEvent),
        devices: devices.rows.map(_shared_1.mapTenantDevice),
        exportedAt: (0, _shared_1.formatLocalTimestamp)(),
    };
}
