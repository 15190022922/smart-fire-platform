"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MqttAdapter = void 0;
const runtime_metrics_1 = require("../../lib/runtime-metrics");
class MqttAdapter {
    constructor(options = {}) {
        this.options = options;
    }
    start() {
        if (!this.options.brokerUrl) {
            return;
        }
        console.log(`[mqtt-adapter] skeleton ready for broker ${this.options.brokerUrl}`);
    }
    stop() {
        return;
    }
    normalizeMessage(topic, payload) {
        try {
            const parsed = JSON.parse(payload);
            return {
                event_id: typeof parsed.event_id === "string" ? parsed.event_id : undefined,
                tenant_id: String(parsed.tenant_id ?? ""),
                device_id: String(parsed.device_id ?? ""),
                gateway_id: typeof parsed.gateway_id === "string" ? parsed.gateway_id : null,
                protocol: "mqtt",
                event_type: String(parsed.event_type ?? ""),
                event_value: (parsed.event_value ?? ""),
                event_time: String(parsed.event_time ?? new Date().toISOString()),
                raw_payload: {
                    topic,
                    ...parsed,
                },
                source: "mqtt_adapter",
            };
        }
        catch (error) {
            (0, runtime_metrics_1.recordRuntimeError)("mqtt_adapter", "MQTT message parse failed", error instanceof Error ? error.message : "");
            return null;
        }
    }
}
exports.MqttAdapter = MqttAdapter;
