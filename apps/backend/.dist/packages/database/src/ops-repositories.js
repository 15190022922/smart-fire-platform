"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantSceneRepository = exports.simulatorRepository = exports.platformRepository = exports.platformNoticeRepository = exports.historyRepository = exports.authRepository = exports.adminRepository = exports.tenantUserRepository = exports.tenantSpatialAreaRepository = exports.tenantOverviewRepository = exports.tenantNotificationRepository = exports.tenantFloorRepository = exports.tenantDrawingRepository = exports.tenantInspectionRepository = exports.inspectionRepository = exports.tenantDutyRepository = exports.dutyRepository = exports.tenantDeviceRepository = exports.tenantDevicePointRepository = exports.tenantAuditRepository = exports.tenantAlarmRepository = void 0;
var tenant_repositories_1 = require("./tenant-repositories");
Object.defineProperty(exports, "tenantAlarmRepository", { enumerable: true, get: function () { return tenant_repositories_1.tenantAlarmRepository; } });
Object.defineProperty(exports, "tenantAuditRepository", { enumerable: true, get: function () { return tenant_repositories_1.tenantAuditRepository; } });
Object.defineProperty(exports, "tenantDevicePointRepository", { enumerable: true, get: function () { return tenant_repositories_1.tenantDevicePointRepository; } });
Object.defineProperty(exports, "tenantDeviceRepository", { enumerable: true, get: function () { return tenant_repositories_1.tenantDeviceRepository; } });
Object.defineProperty(exports, "dutyRepository", { enumerable: true, get: function () { return tenant_repositories_1.tenantDutyRepository; } });
Object.defineProperty(exports, "tenantDutyRepository", { enumerable: true, get: function () { return tenant_repositories_1.tenantDutyRepository; } });
Object.defineProperty(exports, "inspectionRepository", { enumerable: true, get: function () { return tenant_repositories_1.tenantInspectionRepository; } });
Object.defineProperty(exports, "tenantInspectionRepository", { enumerable: true, get: function () { return tenant_repositories_1.tenantInspectionRepository; } });
Object.defineProperty(exports, "tenantDrawingRepository", { enumerable: true, get: function () { return tenant_repositories_1.tenantDrawingRepository; } });
Object.defineProperty(exports, "tenantFloorRepository", { enumerable: true, get: function () { return tenant_repositories_1.tenantFloorRepository; } });
Object.defineProperty(exports, "tenantNotificationRepository", { enumerable: true, get: function () { return tenant_repositories_1.tenantNotificationRepository; } });
Object.defineProperty(exports, "tenantOverviewRepository", { enumerable: true, get: function () { return tenant_repositories_1.tenantOverviewRepository; } });
Object.defineProperty(exports, "tenantSpatialAreaRepository", { enumerable: true, get: function () { return tenant_repositories_1.tenantSpatialAreaRepository; } });
Object.defineProperty(exports, "tenantUserRepository", { enumerable: true, get: function () { return tenant_repositories_1.tenantUserRepository; } });
exports.adminRepository = __importStar(require("./repositories/admin-repository"));
exports.authRepository = __importStar(require("./repositories/auth-repository"));
exports.historyRepository = __importStar(require("./repositories/history-repository"));
exports.platformNoticeRepository = __importStar(require("./repositories/platform-notices-repository"));
exports.platformRepository = __importStar(require("./repositories/platform-repository"));
exports.simulatorRepository = __importStar(require("./repositories/simulator-repository"));
exports.tenantSceneRepository = __importStar(require("./repositories/tenant-scene-repository"));
