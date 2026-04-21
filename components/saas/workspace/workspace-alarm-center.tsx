"use client";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { FeatureGuard } from "@/components/saas/feature-guard";
import { useSaaSDemo } from "@/components/saas/saas-demo-provider";

export function WorkspaceAlarmCenter() {
  const { currentTenantAlarms } = useSaaSDemo();

  return (
    <FeatureGuard title="报警中心" featureKey="alarm_center" permissionKey="tenant.alarms.view">
      <div className="space-y-6">
        <PageHeader title="报警中心" subtitle="仅展示当前企业的报警事件，不会跨租户串数据。" />
        <SectionCard title="报警列表" description="按处理状态、设备和位置查看当前企业最新报警。">
          <div className="overflow-x-auto rounded-[24px] border border-[color:var(--border)]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--table-head)] text-[color:var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">时间</th>
                  <th className="px-4 py-3 font-medium">设备名称</th>
                  <th className="px-4 py-3 font-medium">位置</th>
                  <th className="px-4 py-3 font-medium">报警类型</th>
                  <th className="px-4 py-3 font-medium">处理状态</th>
                </tr>
              </thead>
              <tbody>
                {currentTenantAlarms.map((alarm, index) => (
                  <tr
                    key={alarm.id}
                    className="border-t border-[color:var(--border)]"
                    style={{ backgroundColor: index % 2 === 0 ? "var(--table-row)" : "var(--table-row-alt)" }}
                  >
                    <td className="px-4 py-4 text-[color:var(--text-secondary)]">{alarm.time}</td>
                    <td className="px-4 py-4 font-medium text-[color:var(--text-primary)]">{alarm.deviceName}</td>
                    <td className="px-4 py-4 text-[color:var(--text-secondary)]">{alarm.location}</td>
                    <td className="px-4 py-4 text-[color:var(--text-secondary)]">{alarm.alarmType}</td>
                    <td className="px-4 py-4"><StatusBadge status={alarm.processStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </FeatureGuard>
  );
}
