import {
  deleteTenantDevice,
  getTenantAlarmCenterData,
  getTenantAuditLogs,
  getTenantNotificationCenterData,
  getTenantOverview,
  getTenantSpatialModel,
  getTenantSystemHealth,
  listTenantDevices,
  updateTenantAlarmWorkflow,
  upsertTenantDevice,
} from "../../../lib/db";

export const tenantAlarmRepository = {
  list: getTenantAlarmCenterData,
  updateWorkflow: updateTenantAlarmWorkflow,
};

export const tenantNotificationRepository = {
  getCenterData: getTenantNotificationCenterData,
};

export const tenantAuditRepository = {
  list: getTenantAuditLogs,
};

export const tenantHealthRepository = {
  getPayload: getTenantSystemHealth,
};

export const tenantOverviewRepository = {
  getOverview: getTenantOverview,
  getSpatialModel: getTenantSpatialModel,
};

export const tenantDeviceRepository = {
  list: listTenantDevices,
  upsert: upsertTenantDevice,
  remove: deleteTenantDevice,
};
