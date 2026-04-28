"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlatformTenantScene = getPlatformTenantScene;
const admin_repository_1 = require("./admin-repository");
const alarms_repository_1 = require("./alarms-repository");
const devices_repository_1 = require("./devices-repository");
const notification_repository_1 = require("./notification-repository");
const spatial_repository_1 = require("./spatial-repository");
async function getPlatformTenantScene(tenantId) {
    const tenant = await (0, admin_repository_1.getTenantById)(tenantId);
    if (!tenant) {
        return null;
    }
    const [spatialModel, devices, alarms, notificationCenter] = await Promise.all([
        (0, spatial_repository_1.getTenantSpatialModelData)(tenantId),
        (0, devices_repository_1.listTenantDevices)(tenantId),
        (0, alarms_repository_1.listTenantAlarmCenterData)(tenantId),
        (0, notification_repository_1.getTenantNotificationCenterData)(tenantId),
    ]);
    return {
        tenant,
        spatialModel,
        devices,
        alarms,
        notificationRecords: notificationCenter.records,
    };
}
