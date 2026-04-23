"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantDeviceRepository = exports.tenantOverviewRepository = exports.tenantHealthRepository = exports.tenantAuditRepository = exports.tenantNotificationRepository = exports.tenantAlarmRepository = void 0;
const db_1 = require("../../../lib/db");
exports.tenantAlarmRepository = {
    list: db_1.getTenantAlarmCenterData,
    updateWorkflow: db_1.updateTenantAlarmWorkflow,
};
exports.tenantNotificationRepository = {
    getCenterData: db_1.getTenantNotificationCenterData,
};
exports.tenantAuditRepository = {
    list: db_1.getTenantAuditLogs,
};
exports.tenantHealthRepository = {
    getPayload: db_1.getTenantSystemHealth,
};
exports.tenantOverviewRepository = {
    getOverview: db_1.getTenantOverview,
    getSpatialModel: db_1.getTenantSpatialModel,
};
exports.tenantDeviceRepository = {
    list: db_1.listTenantDevices,
    upsert: db_1.upsertTenantDevice,
    remove: db_1.deleteTenantDevice,
};
