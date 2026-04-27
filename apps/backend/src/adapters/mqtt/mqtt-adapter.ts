import type { SharedNormalizedDeviceEvent } from "../../../../../packages/shared/src/contracts";
import { recordRuntimeError } from "../../lib/runtime-metrics";

export type MqttAdapterOptions = {
  brokerUrl?: string;
  topicPrefix?: string;
};

export class MqttAdapter {
  constructor(private readonly options: MqttAdapterOptions = {}) {}

  start() {
    if (!this.options.brokerUrl) {
      return;
    }
    console.log(`[mqtt-adapter] skeleton ready for broker ${this.options.brokerUrl}`);
  }

  stop() {
    return;
  }

  normalizeMessage(topic: string, payload: string): SharedNormalizedDeviceEvent | null {
    try {
      const parsed = JSON.parse(payload) as Record<string, unknown>;
      return {
        event_id: typeof parsed.event_id === "string" ? parsed.event_id : undefined,
        tenant_id: String(parsed.tenant_id ?? ""),
        device_id: String(parsed.device_id ?? ""),
        gateway_id: typeof parsed.gateway_id === "string" ? parsed.gateway_id : null,
        protocol: "mqtt",
        event_type: String(parsed.event_type ?? "") as SharedNormalizedDeviceEvent["event_type"],
        event_value: (parsed.event_value ?? "") as SharedNormalizedDeviceEvent["event_value"],
        event_time: String(parsed.event_time ?? new Date().toISOString()),
        raw_payload: {
          topic,
          ...parsed,
        },
        source: "mqtt_adapter",
      };
    } catch (error) {
      recordRuntimeError("mqtt_adapter", "MQTT message parse failed", error instanceof Error ? error.message : "");
      return null;
    }
  }
}
