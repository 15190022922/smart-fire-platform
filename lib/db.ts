import type { PoolClient } from "pg";
import { hashPassword } from "./password";
import { bootstrapDatabase } from "../packages/database/src/bootstrap";
import { withDbClient } from "../packages/database/src/client";
import {
  adminRepository,
  authRepository,
  historyRepository,
  platformRepository,
  tenantAlarmRepository,
  tenantDevicePointRepository,
  tenantDrawingRepository,
  tenantOverviewRepository,
} from "../packages/database/src/ops-repositories";
import { ALARM_PROCESS_RESOLVED, ALARM_WORKFLOW_PENDING, ALARM_WORKFLOW_PROCESSING } from "../packages/database/src/repositories/_shared";
import { processIngestionEvent } from "../services/ingestion/ingestion-service";
import type { AlarmWorkflowStatus } from "../types/ops";
import type { TenantSpatialModel } from "../types/hardware";

type CreateTenantWithAdminInput = {
  tenant: {
    name: string;
    code: string;
    industry: string;
    contactName: string;
    contactPhone: string;
    status: string;
    note: string;
  };
  admin: {
    username: string;
    displayName: string;
    phone: string;
    password: string;
    roleKey: string;
    note: string;
  };
};

type UpdateTenantInput = {
  id: string;
  name: string;
  code: string;
  industry: string;
  contactName: string;
  contactPhone: string;
  status: string;
  note: string;
};

export async function withClient<T>(runner: (client: PoolClient) => Promise<T>) {
  return withDbClient(runner);
}

function formatDateParts(date: Date, timeZone = "Asia/Shanghai") {
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

export async function ensureDatabase() {
  await bootstrapDatabase({ includeDemoSeed: true });
}

/**
 * @deprecated Use authRepository.findLoginAccountByCredentials.
 */
export async function findLoginAccount(username: string, password: string) {
  await ensureDatabase();
  return authRepository.findLoginAccountByCredentials(username, password);
}

/**
 * @deprecated Use authRepository.updateLoginPasswordByUsername.
 */
export async function updateLoginPassword(username: string, nextPassword: string) {
  await ensureDatabase();
  return authRepository.updateLoginPasswordByUsername(username, nextPassword);
}

/**
 * @deprecated Use platformRepository.getPlatformOverviewData.
 */
export async function getPlatformOverview() {
  await ensureDatabase();
  return platformRepository.getPlatformOverviewData();
}

/**
 * @deprecated Use tenantOverviewRepository.getOverview.
 */
export async function getTenantOverview(tenantId: string) {
  await ensureDatabase();
  return tenantOverviewRepository.getOverview(tenantId);
}

/**
 * @deprecated Use tenantOverviewRepository.getSpatialModel.
 */
export async function getTenantSpatialModel(tenantId: string): Promise<TenantSpatialModel> {
  await ensureDatabase();
  return tenantOverviewRepository.getSpatialModel(tenantId);
}

/**
 * @deprecated Use historyRepository.getTenantHistoryData.
 */
export async function getTenantHistoryData(tenantId: string) {
  await ensureDatabase();
  return historyRepository.getTenantHistoryData(tenantId);
}

/**
 * @deprecated Use adminRepository.getAdminStateData.
 */
export async function getAdminState() {
  await ensureDatabase();
  return adminRepository.getAdminStateData();
}

/**
 * @deprecated Use adminRepository.replaceAdminStateData.
 */
export async function replaceAdminState(input: unknown) {
  await ensureDatabase();
  return adminRepository.replaceAdminStateData(input as Parameters<typeof adminRepository.replaceAdminStateData>[0]);
}

/**
 * @deprecated Use adminRepository.createTenantWithAdminRecord.
 */
export async function createTenantWithAdmin(input: CreateTenantWithAdminInput) {
  await ensureDatabase();
  return adminRepository.createTenantWithAdminRecord({
    tenant: input.tenant,
    admin: {
      username: input.admin.username,
      displayName: input.admin.displayName,
      phone: input.admin.phone,
      passwordHash: hashPassword(input.admin.password),
      roleKey: input.admin.roleKey,
      note: input.admin.note,
    },
  });
}

/**
 * @deprecated Use adminRepository.updateTenantRecord.
 */
export async function updateTenant(input: UpdateTenantInput) {
  await ensureDatabase();
  return adminRepository.updateTenantRecord(input);
}

/**
 * @deprecated Use adminRepository.deleteTenantCascadeRecord.
 */
export async function deleteTenantCascade(tenantId: string) {
  await ensureDatabase();
  return adminRepository.deleteTenantCascadeRecord(tenantId);
}

/**
 * @deprecated Use tenantDrawingRepository.create.
 */
export async function createTenantDrawing(
  tenantId: string,
  input: Parameters<typeof tenantDrawingRepository.create>[1],
) {
  await ensureDatabase();
  return tenantDrawingRepository.create(tenantId, input);
}

/**
 * @deprecated Use tenantDrawingRepository.remove.
 */
export async function deleteTenantDrawing(tenantId: string, drawingId: string) {
  await ensureDatabase();
  return tenantDrawingRepository.remove(tenantId, drawingId);
}

/**
 * @deprecated Use tenantDevicePointRepository.upsert.
 */
export async function upsertTenantDevicePoint(
  tenantId: string,
  input: Parameters<typeof tenantDevicePointRepository.upsert>[1],
) {
  await ensureDatabase();
  return tenantDevicePointRepository.upsert(tenantId, input);
}

/**
 * @deprecated Use tenantDevicePointRepository.remove.
 */
export async function deleteTenantDevicePoint(tenantId: string, pointId: string) {
  await ensureDatabase();
  return tenantDevicePointRepository.remove(tenantId, pointId);
}

/**
 * @deprecated Use tenantAlarmRepository.updateProcessStatus or updateWorkflow.
 */
export async function updateTenantAlarmProcessStatus(
  tenantId: string,
  alarmId: string,
  processStatus: "未处理" | "处理中" | "已处理",
) {
  await ensureDatabase();
  const mappedStatus =
    processStatus === "已处理"
      ? ALARM_PROCESS_RESOLVED
      : processStatus === "处理中"
        ? ALARM_WORKFLOW_PROCESSING
        : ALARM_WORKFLOW_PENDING;
  return tenantAlarmRepository.updateProcessStatus(tenantId, alarmId, mappedStatus);
}

/**
 * @deprecated Use processIngestionEvent in services/ingestion.
 */
export async function ingestDeviceEvent(input: {
  tenantId: string;
  deviceId: string;
  gatewayId?: string;
  eventType: "alarm" | "fault" | "recover" | "heartbeat" | "status_change";
  eventCode: string;
  eventLevel: "info" | "warning" | "critical";
  payload?: Record<string, unknown>;
  source?: string;
  reportedAt?: string;
}) {
  await ensureDatabase();
  const mappedEventType =
    input.eventType === "recover"
      ? "recovery"
      : input.eventType === "status_change"
        ? input.eventCode === "DEVICE_OFFLINE"
          ? "offline"
          : "recovery"
        : input.eventType;
  return processIngestionEvent({
    tenant_id: input.tenantId,
    device_id: input.deviceId,
    gateway_id: input.gatewayId,
    protocol: "http",
    event_type: mappedEventType,
    event_value: input.payload ?? { eventCode: input.eventCode, eventLevel: input.eventLevel },
    event_time: input.reportedAt
      ? new Date(parseDbDate(input.reportedAt)).toISOString()
      : new Date().toISOString(),
    raw_payload: {
      eventCode: input.eventCode,
      eventLevel: input.eventLevel,
      source: input.source ?? "legacy_lib_db",
      payload: input.payload ?? {},
    },
    source: input.source ?? "legacy_lib_db",
  });
}

/**
 * @deprecated Use tenantAlarmRepository.updateWorkflow.
 */
export async function updateTenantAlarmWorkflow(
  tenantId: string,
  input: {
    alarmId: string;
    nextStatus: AlarmWorkflowStatus;
    falseAlarm?: boolean;
    note?: string;
    attachments?: string[];
    assignedUserName?: string;
    operatorName: string;
    operatorRole: string;
  },
) {
  await ensureDatabase();
  return tenantAlarmRepository.updateWorkflow(tenantId, input);
}
