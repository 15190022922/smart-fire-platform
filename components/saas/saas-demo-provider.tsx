"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { featureDefinitions, roleDefinitions } from "@/data/saas-data";
import type {
  FeatureDefinition,
  FeatureKey,
  PermissionKey,
  PlanRecord,
  PlatformUserRecord,
  RoleDefinition,
  SaaSViewMode,
  SubscriptionRecord,
  TenantAlarmRecord,
  TenantDeviceRecord,
  TenantNotificationSetting,
  TenantQuotaUsage,
  TenantRecord,
  TenantUserRecord,
} from "@/types/saas";

type StoredDemoState = {
  mode?: SaaSViewMode;
  selectedTenantId?: string;
  selectedTenantUserId?: string;
};

type AdminStatePayload = {
  tenants: TenantRecord[];
  plans: PlanRecord[];
  subscriptions: SubscriptionRecord[];
  platformUsers: PlatformUserRecord[];
  tenantUsers: TenantUserRecord[];
  tenantDevices: TenantDeviceRecord[];
  tenantAlarms: TenantAlarmRecord[];
  notificationSettings: TenantNotificationSetting[];
  quotaUsage: TenantQuotaUsage[];
};

type SaaSDemoProviderProps = {
  children: React.ReactNode;
  initialAdminState?: AdminStatePayload | null;
};

type SaaSDemoContextValue = {
  loading: boolean;
  mode: SaaSViewMode;
  setMode: (mode: SaaSViewMode) => void;
  tenants: TenantRecord[];
  setTenants: React.Dispatch<React.SetStateAction<TenantRecord[]>>;
  plans: PlanRecord[];
  setPlans: React.Dispatch<React.SetStateAction<PlanRecord[]>>;
  subscriptions: SubscriptionRecord[];
  setSubscriptions: React.Dispatch<React.SetStateAction<SubscriptionRecord[]>>;
  platformUsers: PlatformUserRecord[];
  setPlatformUsers: React.Dispatch<React.SetStateAction<PlatformUserRecord[]>>;
  tenantUsers: TenantUserRecord[];
  setTenantUsers: React.Dispatch<React.SetStateAction<TenantUserRecord[]>>;
  tenantDevices: TenantDeviceRecord[];
  setTenantDevices: React.Dispatch<React.SetStateAction<TenantDeviceRecord[]>>;
  tenantAlarms: TenantAlarmRecord[];
  setTenantAlarms: React.Dispatch<React.SetStateAction<TenantAlarmRecord[]>>;
  notificationSettings: TenantNotificationSetting[];
  setNotificationSettings: React.Dispatch<React.SetStateAction<TenantNotificationSetting[]>>;
  quotaUsage: TenantQuotaUsage[];
  setQuotaUsage: React.Dispatch<React.SetStateAction<TenantQuotaUsage[]>>;
  features: FeatureDefinition[];
  roles: RoleDefinition[];
  selectedPlatformUserId: string;
  setSelectedPlatformUserId: (id: string) => void;
  selectedTenantId: string;
  setSelectedTenantId: (id: string) => void;
  selectedTenantUserId: string;
  setSelectedTenantUserId: (id: string) => void;
  currentPlatformUser: PlatformUserRecord | null;
  currentTenant: TenantRecord | null;
  currentTenantUser: TenantUserRecord | null;
  currentPlan: PlanRecord | null;
  currentSubscription: SubscriptionRecord | null;
  currentTenantDevices: TenantDeviceRecord[];
  currentTenantAlarms: TenantAlarmRecord[];
  currentNotificationSetting: TenantNotificationSetting | null;
  currentQuotaUsage: TenantQuotaUsage | null;
  hasFeature: (featureKey: FeatureKey) => boolean;
  hasPermission: (permissionKey: PermissionKey) => boolean;
};

const STORAGE_KEY = "smart-fire-saas-demo";
const SaaSDemoContext = createContext<SaaSDemoContextValue | null>(null);

function readStoredDemoState(): StoredDemoState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredDemoState) : null;
  } catch {
    return null;
  }
}

function isEnabledStatus(status?: string | null) {
  return status === "启用" || status === "鍚敤";
}

function isActiveSubscription(status?: string | null) {
  return status === "已生效" || status === "试用中" || status === "宸茬敓鏁?" || status === "璇曠敤涓?";
}

export function SaaSDemoProvider({ children, initialAdminState = null }: SaaSDemoProviderProps) {
  const storedState = readStoredDemoState();
  const platformAdminFallback: PlatformUserRecord = {
    id: "platform-user-fallback",
    username: "super.admin",
    phone: "13900110001",
    roleKey: "platform_super_admin",
    status: "启用",
    note: "平台唯一超级管理员",
  };
  const [loading, setLoading] = useState(!initialAdminState);
  const [mode, setMode] = useState<SaaSViewMode>(storedState?.mode ?? "platform");
  const [tenants, setTenants] = useState<TenantRecord[]>(initialAdminState?.tenants ?? []);
  const [plans, setPlans] = useState<PlanRecord[]>(initialAdminState?.plans ?? []);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>(initialAdminState?.subscriptions ?? []);
  const [platformUsers, setPlatformUsers] = useState<PlatformUserRecord[]>(initialAdminState?.platformUsers ?? []);
  const [tenantUsers, setTenantUsers] = useState<TenantUserRecord[]>(initialAdminState?.tenantUsers ?? []);
  const [tenantDevices, setTenantDevices] = useState<TenantDeviceRecord[]>(initialAdminState?.tenantDevices ?? []);
  const [tenantAlarms, setTenantAlarms] = useState<TenantAlarmRecord[]>(initialAdminState?.tenantAlarms ?? []);
  const [notificationSettings, setNotificationSettings] = useState<TenantNotificationSetting[]>(
    initialAdminState?.notificationSettings ?? [],
  );
  const [quotaUsage, setQuotaUsage] = useState<TenantQuotaUsage[]>(initialAdminState?.quotaUsage ?? []);
  const [selectedTenantId, setSelectedTenantId] = useState(
    storedState?.selectedTenantId ?? initialAdminState?.tenants?.[0]?.id ?? "",
  );
  const [selectedTenantUserIdState, setSelectedTenantUserId] = useState(
    storedState?.selectedTenantUserId ?? initialAdminState?.tenantUsers?.[0]?.id ?? "",
  );
  useEffect(() => {
    let active = true;

    async function loadState() {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const response = await fetch("/api/admin/state", { cache: "no-store" });
          if (!response.ok) {
            if (attempt < 2) {
              await new Promise((resolve) => window.setTimeout(resolve, 250));
              continue;
            }
            if (active) {
              setLoading(false);
            }
            return;
          }

          const result = (await response.json()) as AdminStatePayload;
          if (!active) {
            return;
          }

          setTenants(result.tenants ?? []);
          setPlans(result.plans ?? []);
          setSubscriptions(result.subscriptions ?? []);
          setPlatformUsers(result.platformUsers ?? []);
          setTenantUsers(result.tenantUsers ?? []);
          setTenantDevices(result.tenantDevices ?? []);
          setTenantAlarms(result.tenantAlarms ?? []);
          setNotificationSettings(result.notificationSettings ?? []);
          setQuotaUsage(result.quotaUsage ?? []);

          if (!selectedTenantId && result.tenants?.[0]?.id) {
            setSelectedTenantId(result.tenants[0].id);
          }
          if (!selectedTenantUserIdState && result.tenantUsers?.[0]?.id) {
            setSelectedTenantUserId(result.tenantUsers[0].id);
          }

          setLoading(false);
          return;
        } catch {
          if (attempt < 2) {
            await new Promise((resolve) => window.setTimeout(resolve, 250));
            continue;
          }
          if (active) {
            setLoading(false);
          }
        }
      }
    }

    void loadState();

    return () => {
      active = false;
    };
  }, [selectedTenantId, selectedTenantUserIdState]);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        mode,
        selectedTenantId,
        selectedTenantUserId: selectedTenantUserIdState,
      }),
    );
  }, [mode, selectedTenantId, selectedTenantUserIdState]);

  const currentPlatformUser = platformUsers[0] ?? null;
  const effectivePlatformUser = currentPlatformUser ?? platformAdminFallback;
  const currentTenant = tenants.find((tenant) => tenant.id === selectedTenantId) ?? tenants[0] ?? null;

  const tenantScopedUsers = useMemo(
    () => tenantUsers.filter((user) => user.tenantId === currentTenant?.id),
    [currentTenant?.id, tenantUsers],
  );

  const currentTenantUser =
    tenantScopedUsers.find((user) => user.id === selectedTenantUserIdState) ?? tenantScopedUsers[0] ?? null;
  const selectedTenantUserId = currentTenantUser?.id ?? "";
  const currentSubscription =
    subscriptions.find((subscription) => subscription.tenantId === currentTenant?.id) ?? null;
  const currentPlan = plans.find((plan) => plan.id === currentSubscription?.planId) ?? null;
  const currentTenantDevices = tenantDevices.filter((device) => device.tenantId === currentTenant?.id);
  const currentTenantAlarms = tenantAlarms.filter((alarm) => alarm.tenantId === currentTenant?.id);
  const currentNotificationSetting =
    notificationSettings.find((setting) => setting.tenantId === currentTenant?.id) ?? null;
  const currentQuotaUsage = quotaUsage.find((item) => item.tenantId === currentTenant?.id) ?? null;

  const currentTenantRole =
    roleDefinitions.find((role) => role.scope === "tenant" && role.key === currentTenantUser?.roleKey) ?? null;

  function hasFeature(featureKey: FeatureKey) {
    if (mode === "platform") {
      return true;
    }

    return (
      isEnabledStatus(currentTenant?.status) &&
      !!currentTenantUser &&
      isEnabledStatus(currentTenantUser.status) &&
      isActiveSubscription(currentSubscription?.status) &&
      (currentPlan?.featureKeys.includes(featureKey) ?? false)
    );
  }

  function hasPermission(permissionKey: PermissionKey) {
    if (permissionKey.startsWith("platform.")) {
      return true;
    }

    if (loading) {
      return true;
    }

    return (
      isEnabledStatus(currentTenant?.status) &&
      !!currentTenantUser &&
      isEnabledStatus(currentTenantUser.status) &&
      isActiveSubscription(currentSubscription?.status) &&
      (currentTenantRole?.permissions.includes(permissionKey) ?? false)
    );
  }

  const value: SaaSDemoContextValue = {
    loading,
    mode,
    setMode,
    tenants,
    setTenants,
    plans,
    setPlans,
    subscriptions,
    setSubscriptions,
    platformUsers,
    setPlatformUsers,
    tenantUsers,
    setTenantUsers,
    tenantDevices,
    setTenantDevices,
    tenantAlarms,
    setTenantAlarms,
    notificationSettings,
    setNotificationSettings,
    quotaUsage,
    setQuotaUsage,
    features: featureDefinitions,
    roles: roleDefinitions,
    selectedPlatformUserId: currentPlatformUser?.id ?? "",
    setSelectedPlatformUserId: () => {},
    selectedTenantId: currentTenant?.id ?? selectedTenantId,
    setSelectedTenantId,
    selectedTenantUserId,
    setSelectedTenantUserId,
    currentPlatformUser: effectivePlatformUser,
    currentTenant,
    currentTenantUser,
    currentPlan,
    currentSubscription,
    currentTenantDevices,
    currentTenantAlarms,
    currentNotificationSetting,
    currentQuotaUsage,
    hasFeature,
    hasPermission,
  };

  return <SaaSDemoContext.Provider value={value}>{children}</SaaSDemoContext.Provider>;
}

export function useSaaSDemo() {
  const context = useContext(SaaSDemoContext);
  if (!context) {
    throw new Error("useSaaSDemo must be used inside SaaSDemoProvider");
  }
  return context;
}
