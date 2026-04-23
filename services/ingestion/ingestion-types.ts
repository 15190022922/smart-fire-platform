export const ingestionEventTypes = ["alarm", "fault", "offline", "recovery", "heartbeat"] as const;

export type IngestionEventType = (typeof ingestionEventTypes)[number];

export type IngestionEventInput = {
  tenant_id: string;
  device_id: string;
  event_type: IngestionEventType;
  event_value: string | number | Record<string, unknown>;
  event_time: string;
};

export type IngestionEventPayload = IngestionEventInput & {
  gateway_id?: string | null;
  source?: string;
};

export type IngestionProcessResult = {
  success: true;
  raw_event_id: string;
  alarm_id: string | null;
  device_status: "normal" | "alarm" | "fault" | "offline";
  workflow: {
    alarm_created: boolean;
    notification_created: boolean;
    realtime_published: boolean;
  };
  processed_at: string;
};
