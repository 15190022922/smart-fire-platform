import { getInspectionCenterData, createInspectionTask, submitInspectionRecord, updateIssueStatus } from "./repositories/inspection-repository";
import {
  listTenantAlarmCenterData,
  updateTenantAlarmProcessStatus,
  updateTenantAlarmWorkflow,
} from "./repositories/alarms-repository";
import { listTenantAuditLogs } from "./repositories/audit-repository";
import { listTenantDevicePoints, upsertTenantDevicePoint, deleteTenantDevicePoint } from "./repositories/device-points-repository";
import { listTenantDevices, upsertTenantDevice, deleteTenantDevice } from "./repositories/devices-repository";
import { listTenantDrawings, createTenantDrawing, deleteTenantDrawing } from "./repositories/drawings-repository";
import { getDutyCenterData, createDutySchedule, handoverDutySchedule } from "./repositories/duty-repository";
import { getTenantSystemHealth } from "./repositories/health-repository";
import { getTenantNotificationCenterData, retryNotificationRecord } from "./repositories/notification-repository";
import { getTenantOverviewData } from "./repositories/overview-repository";
import { getTenantSpatialModelData } from "./repositories/spatial-repository";
import { listTenantUsers, upsertTenantUser, deleteTenantUser } from "./repositories/users-repository";
import { withTransaction } from "./transaction";
import { formatLocalTimestamp } from "./repositories/_shared";

export const tenantAlarmRepository = {
  list: listTenantAlarmCenterData,
  updateWorkflow: updateTenantAlarmWorkflow,
  updateProcessStatus: updateTenantAlarmProcessStatus,
};

export const tenantNotificationRepository = {
  getCenterData: getTenantNotificationCenterData,
  retry: async (tenantId: string, recordId: string) =>
    withTransaction((client) => retryNotificationRecord(client, tenantId, recordId, formatLocalTimestamp())),
};

export const tenantAuditRepository = {
  list: listTenantAuditLogs,
};

export const tenantHealthRepository = {
  getPayload: getTenantSystemHealth,
};

export const tenantOverviewRepository = {
  getOverview: getTenantOverviewData,
  getSpatialModel: getTenantSpatialModelData,
};

export const tenantDeviceRepository = {
  list: listTenantDevices,
  upsert: async (tenantId: string, input: unknown) => withTransaction((client) => upsertTenantDevice(client, tenantId, input)),
  remove: async (tenantId: string, id: string) => withTransaction((client) => deleteTenantDevice(client, tenantId, id)),
};

export const tenantUserRepository = {
  list: listTenantUsers,
  upsert: async (tenantId: string, input: unknown) => withTransaction((client) => upsertTenantUser(client, tenantId, input)),
  remove: async (tenantId: string, id: string) => withTransaction((client) => deleteTenantUser(client, tenantId, id)),
};

export const tenantDutyRepository = {
  getCenterData: getDutyCenterData,
  createSchedule: createDutySchedule,
  handover: handoverDutySchedule,
};

export const tenantInspectionRepository = {
  getCenterData: getInspectionCenterData,
  createTask: createInspectionTask,
  submitRecord: submitInspectionRecord,
  updateIssue: updateIssueStatus,
};

export const tenantDrawingRepository = {
  list: listTenantDrawings,
  create: createTenantDrawing,
  remove: deleteTenantDrawing,
};

export const tenantDevicePointRepository = {
  list: listTenantDevicePoints,
  upsert: upsertTenantDevicePoint,
  remove: deleteTenantDevicePoint,
};
