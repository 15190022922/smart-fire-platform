"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlarmRealtimePanel } from "@/components/dashboard/alarm-realtime-panel";
import { DashboardChartsPanel } from "@/components/dashboard/dashboard-charts-panel";
import { DashboardTopMetrics } from "@/components/dashboard/dashboard-top-metrics";
import { InteractiveMapPanel } from "@/components/dashboard/interactive-map-panel";
import { getTenantEventBus } from "@/lib/realtime/event-bus";
import type {
  AlarmPointStatus,
  AlarmRecord,
  AlarmTrendPoint,
  AlarmTypeStat,
  DashboardMetric,
  DeviceOverview,
  DeviceOverviewItem,
  FloorZone,
  ProcessStatus,
} from "@/types/platform";
import type { TenantSpatialModel } from "@/types/hardware";
import type { AlarmCenterItem } from "@/types/ops";
import type { RealtimeConnectionState } from "@/types/realtime";
import type { TenantDeviceRecord } from "@/types/saas";

export type TenantOverviewPayload = {
  devices: TenantDeviceRecord[];
  alarms: {
    id: string;
    time: string;
    deviceName: string;
    location: string;
    alarmType: string;
    processStatus: AlarmRecord["processStatus"];
  }[];
};

function parseLocalDateTime(value: string) {
  const normalized = value.trim().replace("T", " ");
  const [datePart, timePart = "00:00:00"] = normalized.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = timePart.split(":").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, second || 0);
}

function isSameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function normalizeProcessStatus(status: ProcessStatus): "未处理" | "处理中" | "已处理" {
  if (status === "未处理" || status === "閺堫亜顦╅悶?" || status === "闁哄牜浜滈ˇ鈺呮偠?") {
    return "未处理";
  }
  if (status === "处理中" || status === "婢跺嫮鎮婃稉?" || status === "濠㈣泛瀚幃濠冪▔?") {
    return "处理中";
  }
  return "已处理";
}

function normalizeDeviceStatus(status: TenantDeviceRecord["status"]) {
  const text = String(status);
  if (text === "报警" || text === "閹躱儴顒?") return "报警";
  if (text === "故障" || text === "閺佸懘娈?") return "故障";
  if (text === "离线" || text === "缁傝崵鍤?") return "离线";
  if (text === "维修中" || text === "缂佺繝鎱ㄦ稉?") return "维修中";
  return "正常";
}

function isOpenAlarm(status: ProcessStatus) {
  const normalized = normalizeProcessStatus(status);
  return normalized === "未处理" || normalized === "处理中";
}

function normalizeAlarmType(alarmType: string) {
  const text = String(alarmType ?? "");
  if (text.includes("鐏") || text.includes("火警")) return "火警报警";
  if (text.includes("鏁呴殰") || text.includes("故障")) return "设备故障";
  if (text.includes("绂荤嚎") || text.includes("离线")) return "设备离线";
  if (text.includes("鎭㈠") || text.includes("恢复")) return "设备恢复";
  if (text.includes("蹇冭烦") || text.includes("心跳")) return "设备心跳";
  return text;
}

function toMetricData(devices: TenantDeviceRecord[], alarms: AlarmRecord[]): DashboardMetric[] {
  const now = new Date();
  const todayAlarms = alarms.filter((alarm) => isSameLocalDay(parseLocalDateTime(alarm.time), now));
  const unresolvedAlarms = alarms.filter((alarm) => isOpenAlarm(alarm.processStatus));
  const handledToday = todayAlarms.filter((alarm) => normalizeProcessStatus(alarm.processStatus) === "已处理").length;
  const faultCount = devices.filter((device) => normalizeDeviceStatus(device.status) === "故障").length;
  const onlineCount = devices.filter((device) => normalizeDeviceStatus(device.status) !== "离线").length;
  const onlineRate = devices.length === 0 ? "0" : ((onlineCount / devices.length) * 100).toFixed(1);

  return [
    {
      title: "今日报警总数",
      value: String(todayAlarms.length),
      trendLabel: "今日新增",
      description: "只统计今天 00:00 以后新发生的报警。",
      tone: "danger",
    },
    {
      title: "未闭环",
      value: String(unresolvedAlarms.length),
      trendLabel: "持续关注",
      description: "包含今日报警和跨日遗留的未处理、处理中报警。",
      tone: "warning",
    },
    {
      title: "今日已处理",
      value: String(handledToday),
      trendLabel: "处置完成",
      description: "统计今天完成闭环的报警数量。",
      tone: "success",
    },
    {
      title: "在线率",
      value: onlineRate,
      unit: "%",
      trendLabel: "设备状态",
      description: "设备在线率按非离线设备占比计算。",
      tone: "info",
    },
    {
      title: "故障数量",
      value: String(faultCount),
      trendLabel: "需检修",
      description: "当前处于故障状态的设备数量。",
      tone: "warning",
    },
  ];
}

function toAlarmFeed(alarms: AlarmCenterItem[] | undefined | null): AlarmRecord[] {
  const now = new Date();
  const source = Array.isArray(alarms) ? alarms : [];

  return source
    .map<AlarmRecord>((alarm) => {
      const alarmDate = parseLocalDateTime(alarm.time);
      const processStatus = normalizeProcessStatus(alarm.workflowStatus as ProcessStatus);
      const isToday = isSameLocalDay(alarmDate, now);
      const isActive = isOpenAlarm(processStatus);

      return {
        id: alarm.id,
        time: alarm.time,
        deviceName: alarm.deviceName,
        location: alarm.location,
        alarmType: normalizeAlarmType(alarm.alarmType),
        processStatus,
        isCarryover: !isToday && isActive,
        isActive,
      };
    })
    .filter((alarm) => {
      const alarmDate = parseLocalDateTime(alarm.time);
      return isSameLocalDay(alarmDate, now) || alarm.isActive;
    });
}

function toZones(spatialModel: TenantSpatialModel, devices: TenantDeviceRecord[]): FloorZone[] {
  const floorsWithDrawings = spatialModel.floors
    .filter((floor) => spatialModel.drawings.some((drawing) => drawing.floorId === floor.id))
    .slice(0, 4);

  return floorsWithDrawings.map((floor, index) => {
    const points = spatialModel.devicePoints
      .filter((point) => point.floorId === floor.id)
      .map((point) => {
        const device = devices.find((item) => item.id === point.deviceId);
        const snapshot = spatialModel.statusSnapshots.find((item) => item.deviceId === point.deviceId);
        const status: AlarmPointStatus =
          snapshot?.status === "alarm"
            ? "报警"
            : snapshot?.status === "fault"
              ? "故障"
              : snapshot?.status === "offline"
                ? "离线"
                : "正常";

        return {
          id: point.id,
          deviceId: point.deviceId,
          deviceName: device?.name ?? point.deviceId,
          positionLabel: device?.location ?? floor.name,
          deviceType: device?.type ?? "未定义设备",
          status,
          x: Math.round(point.x * 100),
          y: Math.round(point.y * 100),
          lastReportAt: snapshot?.lastReportedAt ?? device?.lastReportAt ?? "暂无上报",
        };
      });

    const riskLevel = points.some((point) => point.status === "报警")
      ? "高风险"
      : points.some((point) => point.status === "故障" || point.status === "离线")
        ? "需关注"
        : "正常";

    return {
      id: `zone-${index + 1}`,
      level: floor.name,
      name: floor.description || floor.name,
      riskLevel,
      points,
    };
  });
}

function toDeviceOverview(devices: TenantDeviceRecord[]): DeviceOverview {
  const total = devices.length;
  const online = devices.filter((device) => normalizeDeviceStatus(device.status) !== "离线").length;
  const offline = devices.filter((device) => normalizeDeviceStatus(device.status) === "离线").length;
  const fault = devices.filter((device) => normalizeDeviceStatus(device.status) === "故障").length;
  const maintenance = devices.filter((device) => normalizeDeviceStatus(device.status) === "维修中").length;

  const breakdown: DeviceOverviewItem[] = [
    { label: "在线", count: online, ratio: `${total === 0 ? 0 : Math.max((online / total) * 100, 6)}%`, barClass: "bg-emerald-500" },
    { label: "离线", count: offline, ratio: `${total === 0 ? 0 : Math.max((offline / total) * 100, 6)}%`, barClass: "bg-[var(--text-faint)]" },
    { label: "故障", count: fault, ratio: `${total === 0 ? 0 : Math.max((fault / total) * 100, 6)}%`, barClass: "bg-amber-500" },
    { label: "维修中", count: maintenance, ratio: `${total === 0 ? 0 : Math.max((maintenance / total) * 100, 6)}%`, barClass: "bg-[var(--text-muted)]" },
  ];

  return {
    total,
    online,
    offline,
    fault,
    maintenance,
    onlineRate: `${total === 0 ? 0 : ((online / total) * 100).toFixed(1)}%`,
    breakdown,
  };
}

function toAlarmTypes(alarms: AlarmRecord[]): AlarmTypeStat[] {
  const colors = ["bg-rose-500", "bg-amber-500", "bg-[var(--text-muted)]", "bg-emerald-500", "bg-[var(--text-faint)]"];
  const total = alarms.length || 1;
  const grouped = new Map<string, number>();

  for (const alarm of alarms) {
    grouped.set(alarm.alarmType, (grouped.get(alarm.alarmType) ?? 0) + 1);
  }

  return Array.from(grouped.entries()).map(([label, count], index) => ({
    label,
    count,
    ratio: `${((count / total) * 100).toFixed(0)}%`,
    colorClass: colors[index % colors.length],
  }));
}

function toTrendData(alarms: AlarmRecord[]): AlarmTrendPoint[] {
  const now = new Date();
  const buckets = Array.from({ length: 6 }, (_, index) => {
    const start = new Date(now.getTime() - (5 - index) * 60 * 60 * 1000);
    start.setMinutes(0, 0, 0);
    return start;
  });

  return buckets.map((bucket) => {
    const next = new Date(bucket.getTime() + 60 * 60 * 1000);
    const matching = alarms.filter((alarm) => {
      const time = parseLocalDateTime(alarm.time);
      return time >= bucket && time < next;
    });

    return {
      label: `${String(bucket.getHours()).padStart(2, "0")}:00`,
      total: matching.length,
      pending: matching.filter((alarm) => normalizeProcessStatus(alarm.processStatus) !== "已处理").length,
      handled: matching.filter((alarm) => normalizeProcessStatus(alarm.processStatus) === "已处理").length,
    };
  });
}

function DashboardStatusRail({ overview, alarms }: { overview: DeviceOverview; alarms: AlarmRecord[] }) {
  const activeCount = alarms.filter((alarm) => alarm.isActive).length;
  const carryoverCount = alarms.filter((alarm) => alarm.isCarryover).length;
  const totalDevices = Math.max(overview.total, 1);
  const onlineDegrees = (overview.online / totalDevices) * 360;
  const faultDegrees = (overview.fault / totalDevices) * 360;
  const maintenanceDegrees = (overview.maintenance / totalDevices) * 360;
  const offlineDegrees = (overview.offline / totalDevices) * 360;
  const donutGradient = `conic-gradient(var(--success) 0deg ${onlineDegrees}deg, var(--warning) ${onlineDegrees}deg ${
    onlineDegrees + faultDegrees + maintenanceDegrees
  }deg, var(--text-faint) ${onlineDegrees + faultDegrees + maintenanceDegrees}deg ${
    onlineDegrees + faultDegrees + maintenanceDegrees + offlineDegrees
  }deg, var(--chart-track) ${onlineDegrees + faultDegrees + maintenanceDegrees + offlineDegrees}deg 360deg)`;

  return (
    <aside className="sf-neutral-glass grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-[18px] p-3">
      <div className="border-b border-[color:var(--panel-divider-strong)] pb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-faint)]">运行状态</p>
        <h2 className="mt-1 text-sm font-semibold tracking-[-0.01em] text-[color:var(--text-primary)]">运行状态栏</h2>
      </div>

      <div className="grid grid-cols-2 gap-2 border-b border-[color:var(--panel-divider-strong)] py-2.5">
        <div className="rounded-[12px] border border-[color:var(--panel-divider)] bg-[var(--control-bg-muted)] px-2.5 py-2 shadow-[var(--panel-inset)]">
          <p className="text-[10px] text-[color:var(--text-muted)]">设备总数</p>
          <p className="mt-1 text-xl font-semibold leading-none text-[color:var(--text-primary)]">{overview.total}</p>
        </div>
        <div className="rounded-[12px] border border-[color:var(--panel-divider)] bg-[var(--control-bg-muted)] px-2.5 py-2 shadow-[var(--panel-inset)]">
          <p className="text-[10px] text-[color:var(--text-muted)]">在线率</p>
          <p className="mt-1 text-xl font-semibold leading-none text-[color:var(--text-primary)]">{overview.onlineRate}</p>
        </div>
        <div className="rounded-[12px] border border-[color:var(--panel-divider)] bg-[var(--control-bg-muted)] px-2.5 py-2 shadow-[var(--panel-inset)]">
          <p className="text-[10px] text-[color:var(--text-muted)]">未闭环</p>
          <p className="mt-1 text-xl font-semibold leading-none text-[var(--danger-strong)]">{activeCount}</p>
        </div>
        <div className="rounded-[12px] border border-[color:var(--panel-divider)] bg-[var(--control-bg-muted)] px-2.5 py-2 shadow-[var(--panel-inset)]">
          <p className="text-[10px] text-[color:var(--text-muted)]">跨日</p>
          <p className="mt-1 text-xl font-semibold leading-none text-[var(--warning-strong)]">{carryoverCount}</p>
        </div>
      </div>

      <div className="min-h-0 space-y-2 overflow-hidden pt-2.5">
        <div className="grid grid-cols-[82px_minmax(0,1fr)] items-center gap-3 rounded-[14px] border border-[color:var(--panel-divider)] bg-[var(--control-bg-muted)] px-2.5 py-2.5">
          <div
            className="relative h-[74px] w-[74px] rounded-full shadow-[inset_0_0_18px_rgba(0,0,0,0.32)]"
            style={{ background: donutGradient }}
            aria-label="设备状态分布"
          >
            <div className="absolute inset-[13px] rounded-full border border-[color:var(--panel-divider)] bg-[var(--control-bg)] backdrop-blur-xl" />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] text-[color:var(--text-muted)]">在线率</span>
              <span className="text-sm font-semibold leading-none text-[color:var(--text-primary)]">{overview.onlineRate}</span>
            </div>
          </div>
          <div className="min-w-0 space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-[color:var(--text-secondary)]"><span className="h-2 w-2 rounded-full bg-[var(--success)]" />在线</span>
              <span className="font-semibold text-[color:var(--text-primary)]">{overview.online}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-[color:var(--text-secondary)]"><span className="h-2 w-2 rounded-full bg-[var(--warning)]" />异常</span>
              <span className="font-semibold text-[color:var(--text-primary)]">{overview.fault + overview.maintenance}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-[color:var(--text-secondary)]"><span className="h-2 w-2 rounded-full bg-[var(--text-faint)]" />离线</span>
              <span className="font-semibold text-[color:var(--text-primary)]">{overview.offline}</span>
            </div>
          </div>
        </div>
        {overview.breakdown.map((item) => (
          <div key={item.label} className="rounded-[12px] border border-[color:var(--panel-divider)] bg-[var(--control-bg-muted)] px-2.5 py-2">
            <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
              <span className="font-semibold text-[color:var(--text-secondary)]">{item.label}</span>
              <span className="text-[color:var(--text-muted)]">{item.count}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--chart-track)]">
              <div className={`h-full rounded-full ${item.barClass}`} style={{ width: item.ratio }} />
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

export function LiveVisualizationPage({
  initialOverview,
  initialSpatialModel,
  initialAlarmCenterItems,
}: {
  initialOverview: TenantOverviewPayload;
  initialSpatialModel: TenantSpatialModel;
  initialAlarmCenterItems: AlarmCenterItem[];
}) {
  const [overview, setOverview] = useState(initialOverview);
  const [spatialModel, setSpatialModel] = useState(initialSpatialModel);
  const [alarmCenterItems, setAlarmCenterItems] = useState(initialAlarmCenterItems);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeConnectionState>("connecting");
  const isRefreshingRef = useRef(false);
  const pendingRefreshRef = useRef(false);

  const refresh = useCallback(async () => {
    if (isRefreshingRef.current) {
      pendingRefreshRef.current = true;
      return;
    }
    isRefreshingRef.current = true;

    try {
      do {
        pendingRefreshRef.current = false;
        const [overviewResponse, spatialResponse, alarmCenterResponse] = await Promise.all([
          fetch("/api/tenant/overview", { cache: "no-store" }),
          fetch("/api/tenant/spatial-model", { cache: "no-store" }),
          fetch("/api/tenant/alarm-center", { cache: "no-store" }),
        ]);

        if (overviewResponse.ok) {
          setOverview((await overviewResponse.json()) as TenantOverviewPayload);
        }
        if (spatialResponse.ok) {
          setSpatialModel((await spatialResponse.json()) as TenantSpatialModel);
        }
        if (alarmCenterResponse.ok) {
          const payload = (await alarmCenterResponse.json()) as { alarms?: AlarmCenterItem[] };
          setAlarmCenterItems(Array.isArray(payload.alarms) ? payload.alarms : []);
        }
      } while (pendingRefreshRef.current);
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const pollTimer = window.setInterval(() => {
      void refresh();
    }, 30000);
    const bus = getTenantEventBus();

    const handleFocus = () => void refresh();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };
    const handleUpdate = () => {
      void refresh();
    };
    const unsubscribe = bus.subscribe({
      types: ["alarm_created", "alarm_updated", "device_status_changed", "system_alert"],
      onEvent: handleUpdate,
      onState: (state) => setRealtimeStatus(state),
    });
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      unsubscribe();
      window.clearInterval(pollTimer);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refresh]);

  const alarmFeed = useMemo(() => toAlarmFeed(alarmCenterItems), [alarmCenterItems]);
  const metrics = useMemo(() => toMetricData(overview.devices, alarmFeed), [alarmFeed, overview.devices]);
  const zones = useMemo(() => toZones(spatialModel, overview.devices), [overview.devices, spatialModel]);
  const deviceOverview = useMemo(() => toDeviceOverview(overview.devices), [overview.devices]);
  const alarmTypeStats = useMemo(() => toAlarmTypes(alarmFeed), [alarmFeed]);
  const alarmTrendData = useMemo(() => toTrendData(alarmFeed), [alarmFeed]);

  return (
    <div
      className="grid min-h-0 grid-cols-1 gap-1.5 xl:h-full xl:grid-rows-[64px_minmax(0,1fr)] xl:overflow-hidden"
      style={{
        paddingTop: "var(--tenant-page-top-offset, 2px)",
        gap: "var(--tenant-page-gap, 6px)",
      }}
    >
      <DashboardTopMetrics metrics={metrics} />

      <section
        className="grid min-h-0 gap-1.5 xl:grid-cols-[minmax(220px,13vw)_minmax(0,1fr)_minmax(420px,28vw)]"
        style={{ gap: "var(--tenant-page-gap, 6px)" }}
      >
        <DashboardStatusRail overview={deviceOverview} alarms={alarmFeed} />
        <InteractiveMapPanel zones={zones} />
        <aside className="grid min-h-0 xl:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]" style={{ gap: "var(--tenant-page-gap, 6px)" }}>
          <AlarmRealtimePanel alarms={alarmFeed} realtimeStatus={realtimeStatus} onRefresh={refresh} />
          <DashboardChartsPanel trendData={alarmTrendData} overview={deviceOverview} typeStats={alarmTypeStats} variant="stack" />
        </aside>
      </section>
    </div>
  );
}
