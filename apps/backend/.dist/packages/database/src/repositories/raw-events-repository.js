"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertRawDeviceEventIfNew = insertRawDeviceEventIfNew;
const errors_1 = require("../errors");
async function insertRawDeviceEventIfNew(executor, input) {
    (0, errors_1.assertTenantId)(input.tenantId);
    const result = await executor.query(`
      INSERT INTO raw_device_events (
        id, tenant_id, device_id, gateway_id, event_id, dedupe_key, protocol,
        event_type, event_code, event_level, payload, raw_payload, processing_status, processed_at, reported_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14,$15)
      ON CONFLICT (dedupe_key) DO NOTHING
      RETURNING id
    `, [
        input.id,
        input.tenantId,
        input.deviceId,
        input.gatewayId ?? null,
        input.eventId ?? null,
        input.dedupeKey,
        input.protocol,
        input.eventType,
        input.eventCode,
        input.eventLevel,
        JSON.stringify(input.payload),
        JSON.stringify(input.rawPayload),
        input.processingStatus,
        input.processedAt,
        input.reportedAt,
    ]);
    return (result.rowCount ?? 0) > 0;
}
