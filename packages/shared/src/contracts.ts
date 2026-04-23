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

export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiError = {
  success: false;
  message: string;
};
