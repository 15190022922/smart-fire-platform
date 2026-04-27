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
import type { RealtimeConnectionState, RealtimeEnvelope } from "@/types/realtime";
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

type TenantRealtimeEvent = {
  tenantId: string;
  deviceId: string;
  eventType: string;
  eventCode: string;
  reportedAt: string;
  source?: string;
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

function resolveAlarmTypeFromRealtimeEvent(event: TenantRealtimeEvent) {
  if (event.eventType === "alarm" || event.eventCode === "FIRE_ALARM") return "火警报警";
  if (event.eventType === "fault" || event.eventCode === "DEVICE_FAULT") return "设备故障";
  if (event.eventCode === "DEVICE_OFFLINE") return "设备离线";
  if (event.eventType === "recover" || event.eventCode === "DEVICE_RECOVER") return "设备恢复";
  if (event.eventType === "heartbeat" || event.eventCode === "HEARTBEAT_OK") return "设备心跳";
  return event.eventCode;
}

function resolveStatusFromRealtimeEvent(event: TenantRealtimeEvent): TenantDeviceRecord["status"] {
  if (event.eventType === "alarm" || event.eventCode === "FIRE_ALARM") return "报警";
  if (event.eventType === "fault" || event.eventCode === "DEVICE_FAULT") return "故障";
  if (event.eventCode === "DEVICE_OFFLINE") return "离线";
  if (event.eventType === "recover" || event.eventCode === "DEVICE_RECOVER") return "正常";
  if (event.eventType === "heartbeat" || event.eventCode === "HEARTBEAT_OK") return "正常";
  return "正常";
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
    { label: "离线", count: offline, ratio: `${total === 0 ? 0 : Math.max((offline / total) * 100, 6)}%`, barClass: "bg-slate-500" },
    { label: "故障", count: fault, ratio: `${total === 0 ? 0 : Math.max((fault / total) * 100, 6)}%`, barClass: "bg-amber-500" },
    { label: "维修中", count: maintenance, ratio: `${total === 0 ? 0 : Math.max((maintenance / total) * 100, 6)}%`, barClass: "bg-cyan-500" },
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
  const colors = ["bg-rose-500", "bg-amber-500", "bg-sky-500", "bg-emerald-500", "bg-slate-500"];
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

function applyRealtimeEventToOverview(current: TenantOverviewPayload, event: TenantRealtimeEvent): TenantOverviewPayload {
  const targetDevice = current.devices.find((device) => device.id === event.deviceId);
  const nextDeviceStatus = resolveStatusFromRealtimeEvent(event);
  const nextAlarmType = resolveAlarmTypeFromRealtimeEvent(event);

  const devices = current.devices.map((device) =>
    device.id === event.deviceId
      ? {
          ...device,
          status: nextDeviceStatus,
          lastReportAt: event.reportedAt,
        }
      : device,
  );

  let alarms = current.alarms;

  if (event.eventType === "alarm" || event.eventType === "fault" || event.eventCode === "DEVICE_OFFLINE") {
    const syntheticId = `live-${event.deviceId}-${event.eventCode}-${event.reportedAt}`;
    alarms = [
      {
        id: syntheticId,
        time: event.reportedAt,
        deviceName: targetDevice?.name ?? event.deviceId,
        location: targetDevice?.location ?? targetDevice?.area ?? "未定位",
        alarmType: nextAlarmType,
        processStatus: "未处理",
      },
      ...current.alarms.filter((alarm) => alarm.id !== syntheticId),
    ];
  }

  return {
    devices,
    alarms,
  };
}

function applyRealtimeEventToSpatialModel(current: TenantSpatialModel, event: TenantRealtimeEvent): TenantSpatialModel {
  const nextStatus =
    event.eventType === "alarm" || event.eventCode === "FIRE_ALARM"
      ? "alarm"
      : event.eventType === "fault" || event.eventCode === "DEVICE_FAULT"
        ? "fault"
        : event.eventCode === "DEVICE_OFFLINE"
          ? "offline"
          : "normal";

  const nextPointStyle = nextStatus === "alarm" ? "alarm" : nextStatus === "fault" ? "fault" : nextStatus === "offline" ? "offline" : "normal";

  return {
    ...current,
    statusSnapshots: current.statusSnapshots.some((item) => item.deviceId === event.deviceId)
      ? current.statusSnapshots.map((item) =>
          item.deviceId === event.deviceId
            ? {
                ...item,
                status: nextStatus,
                lastEventType: event.eventType as TenantSpatialModel["statusSnapshots"][number]["lastEventType"],
                lastEventCode: event.eventCode,
                lastReportedAt: event.reportedAt,
                updatedAt: event.reportedAt,
              }
            : item,
        )
      : [
          ...current.statusSnapshots,
          {
            deviceId: event.deviceId,
            tenantId: event.tenantId,
            status: nextStatus,
            lastEventType: event.eventType as TenantSpatialModel["statusSnapshots"][number]["lastEventType"],
            lastEventCode: event.eventCode,
            lastReportedAt: event.reportedAt,
            updatedAt: event.reportedAt,
          },
        ],
    devicePoints: current.devicePoints.map((point) =>
      point.deviceId === event.deviceId
        ? {
            ...point,
            statusStyle: nextPointStyle,
            updatedAt: event.reportedAt,
          }
        : point,
    ),
  };
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

  const refresh = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;

    const [overviewResponse, spatialResponse, alarmCenterResponse] = await Promise.all([
      fetch("/api/tenant/overview", { cache: "no-store" }),
      fetch("/api/tenant/spatial-model", { cache: "no-store" }),
      fetch("/api/tenant/alarm-center", { cache: "no-store" }),
    ]);

    try {
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
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const pollTimer = window.setInterval(() => {
      void refresh();
    }, 60000);
    const bus = getTenantEventBus();

    const handleFocus = () => void refresh();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };
    const handleUpdate = (event: RealtimeEnvelope) => {
      try {
        const payload = event.payload as unknown as TenantRealtimeEvent;
        setOverview((current) => applyRealtimeEventToOverview(current, payload));
        setSpatialModel((current) => applyRealtimeEventToSpatialModel(current, payload));
      } catch {
        // Ignore parse failure and fall back to refresh below.
      }

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
      className="grid min-h-0 grid-cols-1 gap-1.5 xl:h-full xl:grid-rows-[84px_minmax(0,1fr)_148px] xl:overflow-hidden"
      style={{
        paddingTop: "var(--tenant-page-top-offset, 2px)",
        gap: "var(--tenant-page-gap, 6px)",
      }}
    >
      <DashboardTopMetrics metrics={metrics} />

      <section
        className="grid min-h-0 gap-1.5 pt-0.5 xl:grid-cols-[minmax(0,1fr)_368px]"
        style={{ gap: "var(--tenant-page-gap, 6px)" }}
      >
        <InteractiveMapPanel zones={zones} />
        <div className="grid min-h-0 pt-0.5" style={{ gap: "var(--tenant-page-gap, 6px)" }}>
          <AlarmRealtimePanel alarms={alarmFeed} realtimeStatus={realtimeStatus} onRefresh={refresh} />
        </div>
      </section>

      <DashboardChartsPanel trendData={alarmTrendData} overview={deviceOverview} typeStats={alarmTypeStats} />
    </div>
  );
}
