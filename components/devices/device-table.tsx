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
                  ? "border-sky-300/45 bg-sky-400/12 text-sky-100"
                  : "border-white/8 bg-slate-950/65 text-slate-300 hover:border-sky-400/20",
              )}
            >
              {filter}
            </button>
          ))}
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-slate-200">
          <thead className="text-xs uppercase tracking-[0.24em] text-slate-400">
            <tr className="border-b border-white/8">
              <th className="px-4 py-3 font-medium">设备名称</th>
              <th className="px-4 py-3 font-medium">类型</th>
              <th className="px-4 py-3 font-medium">位置</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">最近上报时间</th>
            </tr>
          </thead>
          <tbody>
            {filteredDevices.map((device) => (
              <tr key={device.id} className="border-b border-white/6 last:border-b-0">
                <td className="px-4 py-4 font-medium text-slate-50">{device.name}</td>
                <td className="px-4 py-4 text-slate-300">{device.type}</td>
                <td className="px-4 py-4 text-slate-300">{device.location}</td>
                <td className="px-4 py-4">
                  <StatusBadge status={device.status} />
                </td>
                <td className="px-4 py-4 text-slate-300">{device.lastReportAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
