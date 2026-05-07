/* eslint-disable @typescript-eslint/no-explicit-any */
import { alarmWorkflowStatuses } from "../../../shared/src/contracts";
import {
  normalizeLegacyAlarmTypeText,
  normalizeLegacyText,
  normalizeLegacyStatusText,
  normalizeWorkflowStatusText,
  resolveRuntimeStatusFromAlarmTypeText,
} from "../../../shared/src/legacy-text";
import type {
  AlarmCenterItem,
  AlarmTimelineEntry,
  AuditLogRecord,
  NotificationRecord,
  NotificationTemplateRecord,
  PlatformNoticeAttachment,
  PlatformNoticeDeliveryRecord,
  PlatformNoticeRecord,
  SystemHealthMetric,
  SystemHealthPayload,
} from "../../../../types/ops";
import type { DutyLogRecord, DutyScheduleRecord, DutyShiftRecord } from "../../../../types/duty";
import type {
  InspectionRecord,
  InspectionTaskRecord,
  IssueRecord,
  MaintenanceRecord,
} from "../../../../types/inspection";
import type {
  DeviceStatusSnapshotRecord,
  RawDeviceEventRecord,
  TenantBuildingRecord,
  TenantDevicePointRecord,
  TenantDrawingRecord,
  TenantFloorRecord,
  TenantGatewayRecord,
  TenantSiteRecord,
} from "../../../../types/hardware";
import type { PlatformUserRecord, TenantDeviceRecord, TenantUserRecord } from "../../../../types/saas";

export const ALARM_WORKFLOW_PENDING = alarmWorkflowStatuses[0];
export const ALARM_WORKFLOW_CONFIRMED = alarmWorkflowStatuses[1];
export const ALARM_WORKFLOW_PROCESSING = alarmWorkflowStatuses[2];
export const ALARM_WORKFLOW_COMPLETED = alarmWorkflowStatuses[3];
export const ALARM_WORKFLOW_CLOSED = alarmWorkflowStatuses[4];
export const ALARM_PROCESS_RESOLVED = "已处理";
export const DUTY_STATUS_ACTIVE = "active";
export const DUTY_STATUS_SCHEDULED = "scheduled";
export const DUTY_STATUS_HANDOVER = "handover";
export const ISSUE_STATUS_PENDING = "未整改";
export const ISSUE_STATUS_IN_PROGRESS = "整改中";
export const ISSUE_STATUS_RESOLVED = "已整改";
export const ISSUE_STATUS_REVIEWED = "已复查";

export function formatDateParts(date: Date, timeZone = "Asia/Shanghai") {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value])) as Record<string, string>;
}

export function formatLocalTimestamp(date = new Date(), timeZone = "Asia/Shanghai") {
  const parts = formatDateParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function formatLocalDate(date = new Date(), timeZone = "Asia/Shanghai") {
  const parts = formatDateParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function parseDbDate(value: string) {
  const normalized = String(value ?? "").trim().replace("T", " ");
  const [datePart, timePart = "00:00:00"] = normalized.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = timePart.split(":").map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1, hour || 0, minute || 0, second || 0);
}

export function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function fromJsonArray(raw: unknown) {
  if (Array.isArray(raw)) return raw.map((item) => String(item));
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function jsonStringArray(raw: unknown) {
  return fromJsonArray(raw);
}

export function normalizeStatusText(value: string) {
  return normalizeLegacyStatusText(value);
}

export function normalizeWorkflowStatus(value: string) {
  return normalizeWorkflowStatusText(value);
}

export function normalizeAlarmTypeText(value: string) {
  return normalizeLegacyAlarmTypeText(value);
}

export function mapTenantDevice(row: any): TenantDeviceRecord {
  const customAttributes =
    row.custom_attributes && typeof row.custom_attributes === "object"
      ? (row.custom_attributes as Record<string, string | number | boolean | null>)
      : {};

  return {
    id: row.id,
    tenantId: row.tenant_id,
    deviceCode: row.device_code ?? "",
    name: row.name,
    type: row.type,
    area: row.area,
    location: row.installation_location,
    installationLocation: row.installation_location,
    status: normalizeStatusText(row.status) as TenantDeviceRecord["status"],
    installationStatus: row.installation_status ?? "",
    lastReportAt: row.last_report_at,
    notes: row.notes,
    customAttributes,
    lifecycleStatus: (row.lifecycle_status || "active") as TenantDeviceRecord["lifecycleStatus"],
    disabledAt: row.disabled_at ?? undefined,
    disabledReason: row.disabled_reason ?? "",
    siteId: row.site_id ?? undefined,
    buildingId: row.building_id ?? undefined,
    floorId: row.floor_id ?? undefined,
    gatewayId: row.gateway_id ?? undefined,
    modelCode: row.model_code ?? "",
    protocolType: row.protocol_type ?? "",
    serialNumber: row.serial_number ?? "",
  };
}

export function mapTenantUser(row: any): TenantUserRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    username: row.username,
    phone: row.phone,
    roleKey: row.role_key,
    status: normalizeStatusText(row.status) as TenantUserRecord["status"],
    smsEnabled: Boolean(row.sms_enabled),
    messageTypes: fromJsonArray(row.message_types).map((item) => normalizeStatusText(item) as TenantUserRecord["messageTypes"][number]),
    note: row.note,
  };
}

export function mapPlatformUser(row: any): PlatformUserRecord {
  return {
    id: row.id,
    username: row.username,
    phone: row.phone,
    roleKey: row.role_key,
    status: normalizeStatusText(row.status) as PlatformUserRecord["status"],
    note: row.note,
  };
}

export function mapAlarm(row: any) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    deviceId: row.device_id,
    deviceName: row.device_name,
    location: row.location,
    alarmType: normalizeAlarmTypeText(row.alarm_type),
    time: row.time,
    processStatus: normalizeStatusText(row.process_status),
  };
}

export function mapAlarmTimeline(row: any): AlarmTimelineEntry {
  return {
    id: row.id,
    action: row.action,
    fromStatus: normalizeWorkflowStatus(row.from_status),
    toStatus: normalizeWorkflowStatus(row.to_status),
    operatorName: row.operator_name,
    operatorRole: row.operator_role,
    note: row.note,
    attachments: jsonStringArray(row.attachments),
    createdAt: row.created_at,
  };
}

export function mapAlarmCenterItem(row: any, timelines: any[]): AlarmCenterItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    deviceId: row.device_id,
    deviceName: row.device_name,
    location: row.location,
    alarmType: normalizeAlarmTypeText(row.alarm_type),
    time: row.time,
    processStatus: normalizeStatusText(row.process_status),
    workflowStatus: normalizeWorkflowStatus(row.workflow_status ?? row.process_status) as AlarmCenterItem["workflowStatus"],
    falseAlarm: Boolean(row.false_alarm),
    detailNote: row.detail_note,
    attachments: jsonStringArray(row.attachments),
    assignedUserName: row.assigned_user_name,
    lastOperatorName: row.last_operator_name,
    acknowledgedAt: row.acknowledged_at ?? undefined,
    processingAt: row.processing_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    closedAt: row.closed_at ?? undefined,
    closedReason: row.closed_reason,
    timeline: timelines.filter((item) => item.alarm_id === row.id).map(mapAlarmTimeline),
  };
}

export function mapNotificationTemplate(row: any): NotificationTemplateRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    channel: row.channel,
    level: row.level,
    targetRoles: jsonStringArray(row.target_roles),
    templateText: row.template_text,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapNotificationRecord(row: any): NotificationRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    alarmId: row.alarm_id ?? undefined,
    templateId: row.template_id ?? undefined,
    channel: row.channel,
    level: row.level,
    targetName: row.target_name,
    content: row.content,
    status: row.status,
    retryCount: Number(row.retry_count),
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPlatformNotice(row: any): PlatformNoticeRecord {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    level: row.level as PlatformNoticeRecord["level"],
    targetMode: row.target_mode as PlatformNoticeRecord["targetMode"],
    status: (row.status ?? "sent") as PlatformNoticeRecord["status"],
    senderName: row.sender_name,
    senderRole: row.sender_role,
    targetTenantCount: Number(row.target_tenant_count ?? 0),
    targetTenantIds: normalizeStringArray(row.target_tenant_ids),
    attachments: platformNoticeAttachments(row.attachments),
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
    publishedAt: row.published_at ?? undefined,
    revokedAt: row.revoked_at ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
    revokeReason: row.revoke_reason ?? undefined,
    requestId: row.request_id ?? undefined,
  };
}

function normalizeStringArray(raw: unknown): string[] {
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map((item) => String(item ?? "").trim()).filter(Boolean);
}

export function platformNoticeAttachments(raw: unknown): PlatformNoticeAttachment[] {
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = [];
    }
  }

  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const value = item as Partial<PlatformNoticeAttachment>;
      const id = String(value.id ?? "").trim();
      const name = String(value.name ?? "").trim();
      const url = String(value.url ?? "").trim();
      if (!id || !name || !url) return null;
      const attachment: PlatformNoticeAttachment = {
        id,
        name,
        url,
        size: Number(value.size ?? 0),
        contentType: String(value.contentType ?? "application/octet-stream"),
      };
      if (value.noticeId) attachment.noticeId = String(value.noticeId);
      if (value.status) attachment.status = value.status;
      if (value.createdAt) attachment.createdAt = String(value.createdAt);
      if (value.boundAt) attachment.boundAt = String(value.boundAt);
      return attachment;
    })
    .filter((item): item is PlatformNoticeAttachment => Boolean(item));
}

export function mapPlatformNoticeDelivery(row: any): PlatformNoticeDeliveryRecord {
  return {
    ...mapPlatformNotice(row),
    deliveryId: row.delivery_id ?? row.id,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    deliveredAt: row.delivered_at ?? row.delivery_created_at ?? row.created_at,
    readAt: row.read_at ?? undefined,
    archivedAt: row.archived_at ?? undefined,
  };
}

export function mapTenant(row: any) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    industry: row.industry,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    status: normalizeStatusText(row.status),
    createdAt: row.created_at,
    note: row.note,
  };
}

export function mapPlan(row: any) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    status: normalizeStatusText(row.status),
    priceMonthly: Number(row.price_monthly),
    maxDevices: Number(row.max_devices),
    maxUsers: Number(row.max_users),
    smsQuota: Number(row.sms_quota),
    featureKeys: fromJsonArray(row.feature_keys),
    description: row.description,
  };
}

export function mapSubscription(row: any) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    planId: row.plan_id,
    status: normalizeStatusText(row.status),
    startDate: row.start_date,
    endDate: row.end_date,
    trial: Boolean(row.trial),
    autoRenew: Boolean(row.auto_renew),
  };
}

export function mapNotificationSetting(row: any) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    alarmThreshold: row.alarm_threshold,
    notificationEnabled: Boolean(row.notification_enabled),
    mapPlaceholder: row.map_placeholder,
    remark: row.remark,
  };
}

export function mapQuota(row: any) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    deviceCount: Number(row.device_count),
    userCount: Number(row.user_count),
    smsUsed: Number(row.sms_used),
  };
}

export function mapAuditLog(row: any): AuditLogRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id ?? undefined,
    actorScope: row.actor_scope,
    actorName: row.actor_name,
    actorRole: row.actor_role,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    result: row.result,
    detail: normalizeLegacyText(row.detail),
    createdAt: row.created_at,
  };
}

export function mapDutyShift(row: any): DutyShiftRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    startTime: row.start_time,
    endTime: row.end_time,
    isDefault: Boolean(row.is_default),
  };
}

export function mapDutySchedule(row: any, shifts: DutyShiftRecord[]): DutyScheduleRecord {
  const shift = shifts.find((item) => item.id === row.shift_id);
  return {
    id: row.id,
    tenantId: row.tenant_id,
    dutyDate: row.duty_date,
    shiftId: row.shift_id,
    shiftName: shift?.name ?? row.shift_id,
    shiftStartTime: shift?.startTime ?? "",
    shiftEndTime: shift?.endTime ?? "",
    assigneeName: row.assignee_name,
    assigneePhone: row.assignee_phone,
    assignedBy: row.assigned_by,
    status: row.status,
    startedAt: row.started_at ?? undefined,
    endedAt: row.ended_at ?? undefined,
    handoverNote: row.handover_note ?? "",
  };
}

export function mapDutyLog(row: any): DutyLogRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    scheduleId: row.schedule_id ?? undefined,
    logType: row.log_type,
    content: normalizeLegacyText(row.content),
    operatorName: row.operator_name,
    createdAt: row.created_at,
  };
}

export function mapInspectionTask(row: any): InspectionTaskRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    planType: row.plan_type,
    targetType: row.target_type,
    targetId: row.target_id,
    targetName: row.target_name,
    dueDate: row.due_date,
    assignedTo: row.assigned_to,
    status: row.status,
    note: row.note,
    createdAt: row.created_at,
  };
}

export function mapInspectionRecord(row: any): InspectionRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    taskId: row.task_id,
    result: row.result,
    note: row.note,
    inspectedBy: row.inspected_by,
    inspectedAt: row.inspected_at,
  };
}

export function mapIssue(row: any): IssueRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    title: row.title,
    level: row.level,
    status: normalizeStatusText(row.status) as IssueRecord["status"],
    note: row.note,
    rectificationDeadline: row.rectification_deadline ?? undefined,
    rectifiedAt: row.rectified_at ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    createdAt: row.created_at,
  };
}

export function mapMaintenanceRecord(row: any): MaintenanceRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    deviceId: row.device_id,
    deviceName: row.device_name,
    vendorName: row.vendor_name,
    maintenanceDate: row.maintenance_date,
    nextDueDate: row.next_due_date,
    result: row.result,
    note: row.note,
  };
}

export function mapSite(row: any): TenantSiteRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    code: row.code,
    address: row.address,
    status: row.status,
    description: row.description,
  };
}

export function mapBuilding(row: any): TenantBuildingRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    siteId: row.site_id,
    name: row.name,
    code: row.code,
    levelCount: Number(row.level_count),
    usageType: row.usage_type,
    areaType: row.area_type || row.usage_type || "building",
    hasFloors: row.has_floors !== false,
    sortOrder: Number(row.sort_order ?? 0),
    status: row.status || "active",
    description: row.description ?? "",
  };
}

export function mapFloor(row: any): TenantFloorRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    buildingId: row.building_id,
    name: row.name,
    code: row.code,
    levelIndex: Number(row.level_index),
    sortOrder: Number(row.sort_order ?? row.level_index ?? 0),
    status: row.status || "active",
    description: row.description,
  };
}

export function mapDrawing(row: any): TenantDrawingRecord {
  const fileUrl = row.file_url ?? "";
  const sourceFileUrl = row.source_file_url || fileUrl;
  const previewUrl = row.preview_url || fileUrl;
  const sceneUrl = row.scene_url || previewUrl || fileUrl;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    buildingId: row.building_id ?? "",
    floorId: row.floor_id,
    name: row.name,
    fileUrl,
    fileType: (row.file_type || "image") as TenantDrawingRecord["fileType"],
    sourceFileUrl,
    previewUrl,
    originalFileName: row.original_file_name ?? "",
    fileSize: Number(row.file_size ?? 0),
    processingStatus: (row.processing_status || "ready") as TenantDrawingRecord["processingStatus"],
    processingMessage: row.processing_message ?? "",
    conversionLog: jsonStringArray(row.conversion_log),
    sceneUrl,
    width: Number(row.width),
    height: Number(row.height),
    version: row.version,
    status: row.status,
    updatedAt: row.updated_at,
    publishedAt: row.published_at ?? undefined,
  };
}

export function mapGateway(row: any): TenantGatewayRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    siteId: row.site_id,
    name: row.name,
    protocol: row.protocol,
    serialNumber: row.serial_number,
    status: row.status,
    lastSeenAt: row.last_seen_at,
  };
}

export function mapDevicePoint(row: any): TenantDevicePointRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    deviceId: row.device_id,
    buildingId: row.building_id ?? "",
    floorId: row.floor_id,
    drawingId: row.drawing_id,
    x: Number(row.x),
    y: Number(row.y),
    rotation: Number(row.rotation),
    icon: row.icon,
    statusStyle: row.status_style,
    updatedAt: row.updated_at,
  };
}

export function mapRawDeviceEvent(row: any): RawDeviceEventRecord {
  const rawPayload = row.payload;
  const payload =
    rawPayload && typeof rawPayload === "object" ? (rawPayload as Record<string, unknown>) : ({} as Record<string, unknown>);

  return {
    id: row.id,
    tenantId: row.tenant_id,
    deviceId: row.device_id,
    gatewayId: row.gateway_id ?? undefined,
    eventType: row.event_type,
    eventCode: row.event_code,
    eventLevel: row.event_level,
    payload,
    reportedAt: row.reported_at,
  };
}

export function mapDeviceStatusSnapshot(row: any): DeviceStatusSnapshotRecord {
  return {
    deviceId: row.device_id,
    tenantId: row.tenant_id,
    gatewayId: row.gateway_id ?? undefined,
    status: row.status,
    lastEventType: row.last_event_type,
    lastEventCode: row.last_event_code,
    lastReportedAt: row.last_reported_at,
    updatedAt: row.updated_at,
  };
}

export type DeviceRuntimeStatus = "normal" | "alarm" | "fault" | "offline" | "maintenance";

export function mapRuntimeStatus(runtimeStatus: DeviceRuntimeStatus) {
  return {
    runtimeStatus,
    deviceStatusText:
      runtimeStatus === "alarm"
        ? "报警"
        : runtimeStatus === "fault"
          ? "故障"
          : runtimeStatus === "offline"
            ? "离线"
            : runtimeStatus === "maintenance"
              ? "维修中"
              : "正常",
    pointStatusStyle:
      runtimeStatus === "alarm"
        ? "alarm"
        : runtimeStatus === "fault"
          ? "fault"
          : runtimeStatus === "offline"
            ? "offline"
            : "normal",
  };
}

export function resolveRuntimeStatusFromAlarmType(alarmType: string): DeviceRuntimeStatus {
  return resolveRuntimeStatusFromAlarmTypeText(alarmType);
}

export function buildSystemHealthMetric(input: SystemHealthMetric): SystemHealthMetric {
  return input;
}

export function buildSystemHealthPayload(input: SystemHealthPayload): SystemHealthPayload {
  return input;
}
