import { PlatformRoleKey, SaaSViewMode, TenantRoleKey } from "@/types/saas";

export type AuthScope = "platform" | "tenant";

export type LoginAccount = {
  id: string;
  username: string;
  password: string;
  displayName: string;
  scope: AuthScope;
  roleKey: PlatformRoleKey | TenantRoleKey;
  tenantId?: string;
};

export type AuthSession = {
  userId: string;
  username: string;
  displayName: string;
  scope: AuthScope;
  roleKey: PlatformRoleKey | TenantRoleKey;
  tenantId?: string;
  tenantName?: string;
  defaultView: SaaSViewMode;
};
