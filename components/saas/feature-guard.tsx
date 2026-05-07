"use client";

import { SectionCard } from "@/components/section-card";
import { useSaaSDemo } from "@/components/saas/saas-demo-provider";
import { AlertMessage } from "@/components/ui/alert-message";
import type { FeatureKey, PermissionKey } from "@/types/saas";

export function FeatureGuard({
  title,
  featureKey,
  permissionKey,
  children,
}: {
  title: string;
  featureKey?: FeatureKey;
  permissionKey?: PermissionKey;
  children: React.ReactNode;
}) {
  const { loading, mode, currentPlan, hasFeature, hasPermission } = useSaaSDemo();

  if (loading) {
    return (
      <SectionCard title={`${title} 加载中`} description="正在读取本地持久化数据并校验权限。">
      <div className="sf-metric-block px-4 py-4 text-sm text-[color:var(--text-secondary)]">
          正在加载数据...
        </div>
      </SectionCard>
    );
  }

  const featureAllowed = featureKey ? hasFeature(featureKey) : true;
  const permissionAllowed = permissionKey ? hasPermission(permissionKey) : true;

  if (featureAllowed && permissionAllowed) {
    return <>{children}</>;
  }

  const description =
    mode === "platform"
      ? "平台端默认使用唯一超级管理员账号。若仍出现限制提示，说明本地管理员数据未正常加载。"
      : featureAllowed
        ? "当前企业用户角色没有该页面的访问权限。"
        : `当前套餐 ${currentPlan?.name ?? ""} 未开通该功能，请升级套餐后使用。`;

  return (
    <SectionCard title={`${title} 未开通`} description={description}>
      <AlertMessage tone="warning" className="py-4">
        {mode === "platform"
          ? "平台端权限应默认放行。若此提示仍持续，请刷新页面以重新读取管理员状态。"
          : featureAllowed
            ? "权限校验已生效：功能存在，但当前企业角色不具备访问资格。"
            : "套餐能力校验已生效：入口保留，但页面不会直接报错。"}
      </AlertMessage>
    </SectionCard>
  );
}
