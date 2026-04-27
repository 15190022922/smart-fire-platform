"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSimulatorBootstrapData = getSimulatorBootstrapData;
exports.getSimulatorScene = getSimulatorScene;
const platform_repository_1 = require("./platform-repository");
const tenant_scene_repository_1 = require("./tenant-scene-repository");
async function getSimulatorBootstrapData() {
    return {
        tenants: await (0, platform_repository_1.listPlatformTenants)(),
    };
}
async function getSimulatorScene(tenantId) {
    return (0, tenant_scene_repository_1.getPlatformTenantScene)(tenantId);
}
