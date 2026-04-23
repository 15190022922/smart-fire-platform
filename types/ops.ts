export type AlarmWorkflowStatus = "未处理" | "已确认" | "处理中" | "已完成" | "已关闭";

export type AlarmTimelineEntry = {
  id: string;
  action: string;
  fromStatus: string;
  toStatus: string;
  operatorName: string;
  operatorRole: string;
  note: string;
  attachments: string[];
  createdAt: string;
};

export type AlarmCenterItem = {
  id: string;
  tenantId: string;
  deviceId: string;
  deviceName: string;
  location: string;
  alarmType: string;
  time: string;
  processStatus: string;
  workflowStatus: AlarmWorkflowStatus;
  falseAlarm: boolean;
  detailNote: string;
  attachments: string[];
  assignedUserName: string;
  lastOperatorName: string;
  acknowledgedAt?: string;
  processingAt?: string;
  completedAt?: string;
  closedAt?: string;
  closedReason: string;
  timeline: AlarmTimelineEntry[];
};

export type NotificationTemplateRecord = {
  id: string;
  tenantId: string;
  name: string;
  channel: "sms" | "in_app";
  level: "alarm" | "fault";
  targetRoles: string[];
  templateText: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type NotificationRecord = {
  id: string;
  tenantId: string;
  alarmId?: string;
  templateId?: string;
  channel: "sms" | "in_app";
  level: "alarm" | "fault";
  targetName: string;
  content: string;
  status: "queued" | "sent" | "failed";
  retryCount: number;
  lastError: string;
  createdAt: string;
  updatedAt: string;
};

export type AuditLogRecord = {
  id: string;
  tenantId?: string;
  actorScope: "platform" | "tenant";
  actorName: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  result: "success" | "error";
  detail: string;
  createdAt: string;
};

export type SystemHealthMetric = {
  code: string;
  name: string;
  value: number;
  displayValue: string;
  unit: string;
  level: "normal" | "warning" | "critical";
  detail: string;
};

export type SystemHealthPayload = {
  generatedAt: string;
  metrics: SystemHealthMetric[];
  recentErrors: AuditLogRecord[];
  latestEvents: {
    id: string;
    deviceId: string;
    eventType: string;
    eventCode: string;
    reportedAt: string;
  }[];
};
