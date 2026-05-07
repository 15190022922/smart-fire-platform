import type { SharedIngestionEventType, SharedIngestionProtocol, SharedNormalizedDeviceEvent } from "../../packages/shared/src/contracts";

export const ingestionEventTypes = ["alarm", "fault", "offline", "recovery", "heartbeat"] as const;

export type IngestionEventType = SharedIngestionEventType;

export type IngestionEventInput = {
  event_id?: string;
  tenant_id: string;
  device_id: string;
  event_type: IngestionEventType;
  event_value: string | number | Record<string, unknown>;
  event_time: string;
};

export type IngestionEventPayload = IngestionEventInput & {
  protocol?: SharedIngestionProtocol;
  gateway_id?: string | null;
  raw_payload?: SharedNormalizedDeviceEvent["raw_payload"];
  source?: string;
};

export type IngestionProcessResult = {
  success: true;
  raw_event_id: string;
  alarm_id: string | null;
  device_status: "normal" | "alarm" | "fault" | "offline" | "ignored";
  workflow: {
    alarm_created: boolean;
    notification_created: boolean;
    realtime_published: boolean;
    duplicate_suppressed?: boolean;
    ignored_due_to_disabled?: boolean;
  };
  processed_at: string;
};
