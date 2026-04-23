import type { PoolClient } from "pg";
import type { IngestionEventPayload, IngestionEventType } from "../ingestion/ingestion-types";

export type AlarmEngineContext = {
  client: PoolClient;
  tenantId: string;
  deviceId: string;
  deviceName: string;
  deviceLocation: string;
  reportedAt: string;
  eventType: IngestionEventType;
  eventValue: IngestionEventPayload["event_value"];
};

export type AlarmEngineDecision = {
  nextDeviceStatus: "normal" | "alarm" | "fault" | "offline";
  shouldCreateAlarm: boolean;
  shouldCreateNotification: boolean;
  shouldPublishRealtimeType: "alarm_created" | "alarm_updated" | "device_status_changed" | "heartbeat";
  alarmTypeLabel: string;
  alarmLogAction: string;
  eventCode: string;
};
