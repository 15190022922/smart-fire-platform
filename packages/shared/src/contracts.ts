export const realtimeEventTypes = [
  "alarm_created",
  "alarm_updated",
  "device_status_changed",
  "system_alert",
  "heartbeat",
] as const;

export type SharedRealtimeEventType = (typeof realtimeEventTypes)[number];

export const alarmWorkflowStatuses = ["未处理", "已确认", "处理中", "已完成", "已关闭"] as const;
export type SharedAlarmWorkflowStatus = (typeof alarmWorkflowStatuses)[number];

export const deviceRuntimeStatuses = ["normal", "alarm", "fault", "offline", "maintenance"] as const;
export type SharedDeviceRuntimeStatus = (typeof deviceRuntimeStatuses)[number];

export const ingestionProtocols = ["http", "mqtt", "tcp"] as const;
export type SharedIngestionProtocol = (typeof ingestionProtocols)[number];

export const ingestionEventTypes = ["alarm", "fault", "offline", "recovery", "heartbeat"] as const;
export type SharedIngestionEventType = (typeof ingestionEventTypes)[number];

export type SharedNormalizedDeviceEvent = {
  event_id?: string;
  tenant_id: string;
  device_id: string;
  gateway_id?: string | null;
  protocol: SharedIngestionProtocol;
  event_type: SharedIngestionEventType;
  event_value: string | number | Record<string, unknown>;
  event_time: string;
  raw_payload?: Record<string, unknown> | string | number | null;
  source?: string;
};

export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiError = {
  success: false;
  message: string;
};
