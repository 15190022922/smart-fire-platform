export type RealtimeEventType = "alarm_created" | "alarm_updated" | "device_status_changed" | "system_alert" | "heartbeat";

export type RealtimeEnvelope<T = Record<string, unknown>> = {
  eventId: string;
  tenantId: string;
  type: RealtimeEventType;
  occurredAt: string;
  serverTime: string;
  latencyMs: number;
  payload: T;
};

export type RealtimeConnectionState = "connecting" | "connected" | "reconnecting" | "stale";
