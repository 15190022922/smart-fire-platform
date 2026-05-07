"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantFloorRepository = exports.tenantSpatialAreaRepository = exports.tenantDevicePointRepository = exports.tenantDrawingRepository = exports.tenantInspectionRepository = exports.tenantDutyRepository = exports.tenantUserRepository = exports.tenantDeviceImportRepository = exports.tenantDeviceAttributeRepository = exports.tenantDeviceRepository = exports.tenantOverviewRepository = exports.tenantHealthRepository = exports.tenantAuditRepository = exports.tenantNotificationRepository = exports.tenantAlarmRepository = void 0;
const inspection_repository_1 = require("./repositories/inspection-repository");
const alarms_repository_1 = require("./repositories/alarms-repository");
const audit_repository_1 = require("./repositories/audit-repository");
const device_points_repository_1 = require("./repositories/device-points-repository");
const device_attributes_repository_1 = require("./repositories/device-attributes-repository");
const device_import_repository_1 = require("./repositories/device-import-repository");
const devices_repository_1 = require("./repositories/devices-repository");
const drawings_repository_1 = require("./repositories/drawings-repository");
const duty_repository_1 = require("./repositories/duty-repository");
const health_repository_1 = require("./repositories/health-repository");
const notification_repository_1 = require("./repositories/notification-repository");
const overview_repository_1 = require("./repositories/overview-repository");
const spatial_areas_repository_1 = require("./repositories/spatial-areas-repository");
const spatial_repository_1 = require("./repositories/spatial-repository");
const users_repository_1 = require("./repositories/users-repository");
const transaction_1 = require("./transaction");
const _shared_1 = require("./repositories/_shared");
exports.tenantAlarmRepository = {
    list: alarms_repository_1.listTenantAlarmCenterData,
    updateWorkflow: alarms_repository_1.updateTenantAlarmWorkflow,
    updateProcessStatus: alarms_repository_1.updateTenantAlarmProcessStatus,
};
exports.tenantNotificationRepository = {
    getCenterData: notification_repository_1.getTenantNotificationCenterData,
    retry: async (tenantId, recordId) => (0, transaction_1.withTransaction)((client) => (0, notification_repository_1.retryNotificationRecord)(client, tenantId, recordId, (0, _shared_1.formatLocalTimestamp)())),
};
exports.tenantAuditRepository = {
    list: audit_repository_1.listTenantAuditLogs,
};
exports.tenantHealthRepository = {
    getPayload: health_repository_1.getTenantSystemHealth,
};
exports.tenantOverviewRepository = {
    getOverview: overview_repository_1.getTenantOverviewData,
    getSpatialModel: spatial_repository_1.getTenantSpatialModelData,
};
exports.tenantDeviceRepository = {
    list: devices_repository_1.listTenantDevices,
    upsert: async (tenantId, input) => (0, transaction_1.withTransaction)((client) => (0, devices_repository_1.upsertTenantDevice)(client, tenantId, input)),
    remove: async (tenantId, id) => (0, transaction_1.withTransaction)((client) => (0, devices_repository_1.deleteTenantDevice)(client, tenantId, id)),
    previewLifecycle: async (tenantId, input) => (0, transaction_1.withTransaction)((client) => (0, devices_repository_1.previewTenantDeviceLifecycle)(client, tenantId, input)),
    updateLifecycle: async (tenantId, input) => (0, transaction_1.withTransaction)((client) => (0, devices_repository_1.updateTenantDeviceLifecycle)(client, tenantId, input)),
};
exports.tenantDeviceAttributeRepository = {
    list: device_attributes_repository_1.listTenantDeviceAttributes,
    upsert: async (tenantId, input) => (0, transaction_1.withTransaction)((client) => (0, device_attributes_repository_1.upsertTenantDeviceAttribute)(client, tenantId, input)),
    disable: async (tenantId, fieldKey) => (0, transaction_1.withTransaction)((client) => (0, device_attributes_repository_1.disableTenantDeviceAttribute)(client, tenantId, fieldKey)),
};
exports.tenantDeviceImportRepository = {
    preview: async (tenantId, input) => (0, transaction_1.withTransaction)((client) => (0, device_import_repository_1.previewTenantDeviceImport)(client, tenantId, input)),
    commit: async (tenantId, input) => (0, transaction_1.withTransaction)((client) => (0, device_import_repository_1.commitTenantDeviceImport)(client, tenantId, input)),
};
exports.tenantUserRepository = {
    list: users_repository_1.listTenantUsers,
    upsert: async (tenantId, input) => (0, transaction_1.withTransaction)((client) => (0, users_repository_1.upsertTenantUser)(client, tenantId, input)),
    remove: async (tenantId, id) => (0, transaction_1.withTransaction)((client) => (0, users_repository_1.deleteTenantUser)(client, tenantId, id)),
};
exports.tenantDutyRepository = {
    getCenterData: duty_repository_1.getDutyCenterData,
    createSchedule: duty_repository_1.createDutySchedule,
    handover: duty_repository_1.handoverDutySchedule,
};
exports.tenantInspectionRepository = {
    getCenterData: inspection_repository_1.getInspectionCenterData,
    createTask: inspection_repository_1.createInspectionTask,
    submitRecord: inspection_repository_1.submitInspectionRecord,
    updateIssue: inspection_repository_1.updateIssueStatus,
};
exports.tenantDrawingRepository = {
    list: drawings_repository_1.listTenantDrawings,
    create: drawings_repository_1.createTenantDrawing,
    updateStatus: drawings_repository_1.updateTenantDrawingStatus,
    remove: drawings_repository_1.deleteTenantDrawing,
};
exports.tenantDevicePointRepository = {
    list: device_points_repository_1.listTenantDevicePoints,
    upsert: device_points_repository_1.upsertTenantDevicePoint,
    remove: device_points_repository_1.deleteTenantDevicePoint,
};
exports.tenantSpatialAreaRepository = {
    create: spatial_areas_repository_1.createTenantSpatialArea,
    update: spatial_areas_repository_1.updateTenantSpatialArea,
    remove: spatial_areas_repository_1.deleteTenantSpatialArea,
};
exports.tenantFloorRepository = {
    create: spatial_areas_repository_1.createTenantFloor,
    update: spatial_areas_repository_1.updateTenantFloor,
    remove: spatial_areas_repository_1.deleteTenantFloor,
};
