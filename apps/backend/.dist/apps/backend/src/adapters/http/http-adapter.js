"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeHttpEvent = normalizeHttpEvent;
function normalizeHttpEvent(body) {
    return {
        event_id: typeof body.event_id === "string" ? body.event_id : undefined,
        tenant_id: String(body.tenant_id ?? ""),
        device_id: String(body.device_id ?? ""),
        gateway_id: typeof body.gateway_id === "string" ? body.gateway_id : null,
        protocol: "http",
        event_type: String(body.event_type ?? ""),
        event_value: (body.event_value ?? ""),
        event_time: String(body.event_time ?? ""),
        raw_payload: body.raw_payload && typeof body.raw_payload === "object" ? body.raw_payload : body,
        source: "http_adapter",
    };
}
