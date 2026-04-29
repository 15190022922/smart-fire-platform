"use client";

import { useMemo, useState } from "react";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { deviceStatusFilters } from "@/data/platform-data";
import { cn } from "@/lib/cn";
import { DeviceRecord, DeviceStatusFilter } from "@/types/platform";

export function DeviceTable({ devices }: { devices: DeviceRecord[] }) {
  const [activeFilter, setActiveFilter] = useState<DeviceStatusFilter>("全部");

  const filteredDevices = useMemo(() => {
    if (activeFilter === "全部") {
      return devices;
    }

    return devices.filter((device) => device.status === activeFilter);
  }, [activeFilter, devices]);

  return (
    <SectionCard
      title="设备列表"
      description="支持按状态筛选设备信息，后续可扩展搜索、分页、批量操作与远程控制。"
      extra={
        <div className="flex flex-wrap gap-2">
          {deviceStatusFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm transition",
                activeFilter === filter
                  ? "border-[color:var(--accent)] bg-[var(--accent-soft)] text-[color:var(--accent-strong)]"
                  : "border-[color:var(--border-soft)] bg-[var(--panel-cell-bg)] text-[color:var(--text-secondary)] hover:border-[color:var(--border)]",
              )}
            >
              {filter}
            </button>
          ))}
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-[color:var(--text-secondary)]">
          <thead className="text-xs uppercase tracking-[0.24em] text-[color:var(--text-muted)]">
            <tr className="border-b border-[color:var(--border-soft)]">
              <th className="px-4 py-3 font-medium">设备名称</th>
              <th className="px-4 py-3 font-medium">类型</th>
              <th className="px-4 py-3 font-medium">位置</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">最近上报时间</th>
            </tr>
          </thead>
          <tbody>
            {filteredDevices.map((device) => (
              <tr key={device.id} className="border-b border-[color:var(--border-soft)] last:border-b-0">
                <td className="px-4 py-4 font-medium text-[color:var(--text-primary)]">{device.name}</td>
                <td className="px-4 py-4 text-[color:var(--text-secondary)]">{device.type}</td>
                <td className="px-4 py-4 text-[color:var(--text-secondary)]">{device.location}</td>
                <td className="px-4 py-4">
                  <StatusBadge status={device.status} />
                </td>
                <td className="px-4 py-4 text-[color:var(--text-secondary)]">{device.lastReportAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
