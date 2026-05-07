export {
  tenantAlarmRepository,
  tenantAuditRepository,
  tenantDevicePointRepository,
  tenantDeviceRepository,
  tenantDutyRepository as dutyRepository,
  tenantDutyRepository,
  tenantInspectionRepository as inspectionRepository,
  tenantInspectionRepository,
  tenantDrawingRepository,
  tenantFloorRepository,
  tenantNotificationRepository,
  tenantOverviewRepository,
  tenantSpatialAreaRepository,
  tenantUserRepository,
} from "./tenant-repositories";
export * as adminRepository from "./repositories/admin-repository";
export * as authRepository from "./repositories/auth-repository";
export * as historyRepository from "./repositories/history-repository";
export * as platformNoticeRepository from "./repositories/platform-notices-repository";
export * as platformRepository from "./repositories/platform-repository";
export * as simulatorRepository from "./repositories/simulator-repository";
export * as tenantSceneRepository from "./repositories/tenant-scene-repository";
