import { listPlatformTenants } from "./platform-repository";
import { getPlatformTenantScene } from "./tenant-scene-repository";

export async function getSimulatorBootstrapData() {
  return {
    tenants: await listPlatformTenants(),
  };
}

export async function getSimulatorScene(tenantId: string) {
  return getPlatformTenantScene(tenantId);
}
