"use client";

import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { ActionButton } from "@/components/ui/action-button";
import { AlertMessage } from "@/components/ui/alert-message";
import { fieldClassName as baseFieldClassName, fieldErrorClassName } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast-center";
import type { TenantSpatialModel } from "@/types/hardware";
import type { AlarmCenterItem, NotificationRecord } from "@/types/ops";
import type { TenantDeviceRecord, TenantRecord } from "@/types/saas";

type ScenePayload = {
  tenant: TenantRecord;
  spatialModel: TenantSpatialModel;
  devices: TenantDeviceRecord[];
  alarms?: AlarmCenterItem[];
  notificationRecords?: NotificationRecord[];
};

type IngestionResult = {
  success: true;
  raw_event_id: string;
  alarm_id: string | null;
  device_status: string;
  workflow: {
    alarm_created: boolean;
    notification_created: boolean;
    realtime_published: boolean;
    duplicate_suppressed?: boolean;
  };
  processed_at: string;
};

type SendResult = {
  eventLabel: string;
  deviceName: string;
  processedAt: string;
  alarmId: string | null;
  deviceStatus: string;
  alarmCreated: boolean;
  notificationCreated: boolean;
  realtimePublished: boolean;
  duplicateSuppressed: boolean;
};

const eventOptions = [
  { key: "alarm", label: "\u706b\u8b66\u62a5\u8b66", eventType: "alarm" },
  { key: "fault", label: "\u8bbe\u5907\u6545\u969c", eventType: "fault" },
  { key: "offline", label: "\u8bbe\u5907\u79bb\u7ebf", eventType: "offline" },
  { key: "recover", label: "\u8bbe\u5907\u6062\u590d", eventType: "recovery" },
  { key: "heartbeat", label: "\u53d1\u9001\u5fc3\u8df3", eventType: "heartbeat" },
] as const;

const inputClassName = baseFieldClassName;

async function fetchScene(tenantId: string) {
  let response: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    response = await fetch(`/api/platform/tenant-scene?tenantId=${encodeURIComponent(tenantId)}`, {
      cache: "no-store",
    }).catch(() => null);
    if (response?.ok) break;
    await new Promise((resolve) => window.setTimeout(resolve, 180));
  }

  if (!response?.ok) {
    throw new Error("LOAD_SCENE_FAILED");
  }

  return (await response.json()) as ScenePayload;
}

function normalizeSnapshotStatus(status?: string) {
  const normalized = String(status ?? "").trim();
  if (normalized === "alarm" || normalized === "\u62a5\u8b66") return "\u62a5\u8b66";
  if (normalized === "fault" || normalized === "\u6545\u969c") return "\u6545\u969c";
  if (normalized === "offline" || normalized === "\u79bb\u7ebf") return "\u79bb\u7ebf";
  if (normalized === "maintenance" || normalized === "\u7ef4\u4fee\u4e2d" || normalized === "\u7ef4\u4fdd\u4e2d") return "\u7ef4\u4fee\u4e2d";
  if (!normalized || normalized === "normal" || normalized === "\u6b63\u5e38") return "\u6b63\u5e38";
  return normalized;
}

function requiredLabel(label: string) {
  return (
    <span className="flex items-center gap-1 text-sm text-[color:var(--text-secondary)]">
      {label}
      <span className="text-[color:var(--danger-strong)]">*</span>
    </span>
  );
}

function fieldClassName(hasError: boolean) {
  return `${inputClassName} ${hasError ? fieldErrorClassName : ""}`;
}

export function DeviceSimulatorConsole({
  tenants,
  initialScene,
  embedded = false,
}: {
  tenants: TenantRecord[];
  initialScene: ScenePayload | null;
  embedded?: boolean;
}) {
  const { pushToast } = useToast();
  const [selectedTenantId, setSelectedTenantId] = useState(initialScene?.tenant.id ?? tenants[0]?.id ?? "");
  const [scene, setScene] = useState<ScenePayload | null>(initialScene);
  const [selectedDrawingId, setSelectedDrawingId] = useState(initialScene?.spatialModel.drawings[0]?.id ?? "");
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<SendResult | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<"tenantId" | "deviceId", string>>>({});

  useEffect(() => {
    let active = true;

    async function loadScene() {
      if (!selectedTenantId) return;

      try {
        const result = await fetchScene(selectedTenantId);
        if (!active) return;
        setScene(result);
        setSelectedDrawingId(result.spatialModel.drawings[0]?.id ?? "");
        setSelectedDeviceId("");
        setFieldErrors({});
      } catch {
        if (active) {
          pushToast({ message: "企业测试场景加载失败，请确认管理端 backend 已启动。", tone: "error" });
        }
      }
    }

    void loadScene();
    return () => {
      active = false;
    };
  }, [pushToast, selectedTenantId]);

  const pointsForDrawing = useMemo(
    () => scene?.spatialModel.devicePoints.filter((point) => point.drawingId === selectedDrawingId) ?? [],
    [scene, selectedDrawingId],
  );
  const selectedDrawing = useMemo(
    () => scene?.spatialModel.drawings.find((drawing) => drawing.id === selectedDrawingId) ?? null,
    [scene, selectedDrawingId],
  );
  const selectedDevice = useMemo(
    () => scene?.devices.find((device) => device.id === selectedDeviceId) ?? null,
    [scene?.devices, selectedDeviceId],
  );
  const hasDrawings = (scene?.spatialModel.drawings.length ?? 0) > 0;
  const fallbackDevices = useMemo(() => {
    if (!scene) return [];
    return [...scene.devices].sort((a, b) => {
      const areaCompare = (a.area ?? "").localeCompare(b.area ?? "", "zh-CN");
      return areaCompare !== 0 ? areaCompare : a.name.localeCompare(b.name, "zh-CN");
    });
  }, [scene]);
  const latestAlarms = useMemo(() => scene?.alarms?.slice(0, 5) ?? [], [scene?.alarms]);
  const lastResultAlarmId = lastResult?.alarmId;
  const latestNotificationRecords = useMemo(
    () => scene?.notificationRecords?.filter((record) => !lastResultAlarmId || record.alarmId === lastResultAlarmId) ?? [],
    [lastResultAlarmId, scene?.notificationRecords],
  );

  async function sendEvent(option: (typeof eventOptions)[number]) {
    const nextFieldErrors: Partial<Record<"tenantId" | "deviceId", string>> = {};
    if (!selectedTenantId) {
      nextFieldErrors.tenantId = "请选择企业";
    }
    if (!selectedDeviceId || !selectedDevice) {
      nextFieldErrors.deviceId = "请选择设备";
    }
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setSending(true);
    setFieldErrors({});

    const response = await fetch("/api/ingestion/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: scene!.tenant.id,
        device_id: selectedDevice!.id,
        event_type: option.eventType,
        event_value: {
          operator: "platform_admin",
          simulated: true,
          label: option.label,
          gateway_id: selectedDevice!.gatewayId ?? null,
        },
        event_time: new Date().toISOString(),
      }),
    }).catch(() => null);

    if (!response) {
      pushToast({ message: "模拟信号发送失败，请确认 Web 与 backend 都已启动且可互通。", tone: "error" });
      setSending(false);
      return;
    }

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      pushToast({
        message: payload?.message?.trim() || `模拟信号发送失败（HTTP ${response.status}）`,
        tone: "error",
      });
      setSending(false);
      return;
    }

    try {
      const result = (await response.json()) as IngestionResult;
      const sentTenantId = scene!.tenant.id;
      const sentDevice = selectedDevice!;
      const nextStatusLabel = normalizeSnapshotStatus(result.device_status);

      setLastResult({
        eventLabel: option.label,
        deviceName: sentDevice.name,
        processedAt: result.processed_at,
        alarmId: result.alarm_id,
        deviceStatus: result.device_status,
        alarmCreated: Boolean(result.workflow.alarm_created),
        notificationCreated: Boolean(result.workflow.notification_created),
        realtimePublished: Boolean(result.workflow.realtime_published),
        duplicateSuppressed: Boolean(result.workflow.duplicate_suppressed),
      });

      setScene((current) => {
        if (!current || current.tenant.id !== sentTenantId) return current;
        const nextStatus = result.device_status as TenantSpatialModel["statusSnapshots"][number]["status"];
        const nextEventType = (option.eventType === "recovery" ? "recover" : option.eventType) as TenantSpatialModel["statusSnapshots"][number]["lastEventType"];
        const hasSnapshot = current.spatialModel.statusSnapshots.some((item) => item.deviceId === sentDevice.id);
        return {
          ...current,
          devices: current.devices.map((device) =>
            device.id === sentDevice.id
              ? { ...device, status: nextStatusLabel as TenantDeviceRecord["status"], lastReportAt: result.processed_at }
              : device,
          ),
          spatialModel: {
            ...current.spatialModel,
            statusSnapshots: hasSnapshot
              ? current.spatialModel.statusSnapshots.map((item) =>
                  item.deviceId === sentDevice.id
                    ? {
                        ...item,
                        status: nextStatus,
                        lastEventType: nextEventType,
                        lastEventCode: option.eventType,
                        lastReportedAt: result.processed_at,
                        updatedAt: result.processed_at,
                      }
                    : item,
                )
              : [
                  {
                    deviceId: sentDevice.id,
                    tenantId: sentTenantId,
                    gatewayId: sentDevice.gatewayId,
                    status: nextStatus,
                    lastEventType: nextEventType,
                    lastEventCode: option.eventType,
                    lastReportedAt: result.processed_at,
                    updatedAt: result.processed_at,
                  },
                  ...current.spatialModel.statusSnapshots,
                ],
          },
        };
      });

      pushToast({
        message: result.workflow.alarm_created
          ? `${option.label}\u5df2\u521b\u5efa\u62a5\u8b66\uff0c\u62a5\u8b66\u4e2d\u5fc3\u5df2\u66f4\u65b0\u3002`
          : result.workflow.duplicate_suppressed
            ? `${option.label}\u5df2\u63a5\u6536\uff0c\u539f\u59cb\u4e8b\u4ef6\u5df2\u53bb\u91cd\u3002`
            : `${option.label}\u5df2\u63a5\u6536\uff0c\u8bbe\u5907\u72b6\u6001\u5df2\u66f4\u65b0\u3002`,
        tone: "success",
      });

      void fetchScene(sentTenantId)
        .then((nextScene) => setScene(nextScene))
        .catch(() => {
          pushToast({ message: "\u4e8b\u4ef6\u5df2\u53d1\u9001\uff0c\u573a\u666f\u5217\u8868\u7a0d\u540e\u81ea\u52a8\u5237\u65b0\u3002", tone: "warning" });
        });
    } catch {
      pushToast({ message: "\u4e8b\u4ef6\u5df2\u53d1\u9001\uff0c\u4f46\u54cd\u5e94\u89e3\u6790\u5931\u8d25\uff0c\u8bf7\u5237\u65b0\u540e\u67e5\u770b\u3002", tone: "warning" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={embedded ? "space-y-5" : "mx-auto min-h-screen max-w-[1800px] space-y-6 px-4 py-6"}>
      {!embedded ? (
        <section className="sf-panel p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--danger-strong)]">Device Test Console</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[color:var(--text-primary)]">设备模拟测试台</h1>
              <p className="mt-3 text-sm leading-7 text-[color:var(--text-muted)]">
                页面只负责发事件，不直接改报警和设备状态。所有模拟信号统一进入设备接入链路，再由报警引擎、通知、实时推送和审计日志承接。
              </p>
            </div>
            <div className="grid min-w-[320px] grid-cols-2 gap-3">
              <div className="sf-metric-block px-4 py-3">
                <p className="text-xs text-[color:var(--text-muted)]">测试企业</p>
                <p className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">{scene?.tenant.name ?? "未选择"}</p>
              </div>
              <div className="sf-metric-block px-4 py-3">
                <p className="text-xs text-[color:var(--text-muted)]">图纸点位</p>
                <p className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">{pointsForDrawing.length}</p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.82fr_1.3fr_0.88fr]">
        <section className="sf-panel p-5">
          <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">控制面板</h2>
          <div className="mt-4 space-y-4">
            <label className="block space-y-2">
              {requiredLabel("选择企业")}
              <select
                value={selectedTenantId}
                onChange={(event) => {
                  setSelectedTenantId(event.target.value);
                  setFieldErrors((current) => ({ ...current, tenantId: "", deviceId: "" }));
                }}
                className={fieldClassName(Boolean(fieldErrors.tenantId))}
              >
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
              {fieldErrors.tenantId ? <span className="text-xs font-medium text-[color:var(--danger-strong)]">{fieldErrors.tenantId}</span> : null}
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--text-secondary)]">选择图纸</span>
              <select
                value={selectedDrawingId}
                onChange={(event) => setSelectedDrawingId(event.target.value)}
                className={inputClassName}
              >
                {!hasDrawings ? <option value="">无图纸模式</option> : null}
                {scene?.spatialModel.drawings.map((drawing) => (
                  <option key={drawing.id} value={drawing.id}>
                    {drawing.name}
                  </option>
                )) ?? <option value="">暂无图纸</option>}
              </select>
            </label>

            <label className="block space-y-2">
              {requiredLabel("当前设备")}
              <select
                value={selectedDeviceId}
                onChange={(event) => {
                  setSelectedDeviceId(event.target.value);
                  setFieldErrors((current) => ({ ...current, deviceId: "" }));
                }}
                className={fieldClassName(Boolean(fieldErrors.deviceId))}
              >
                <option value="">请选择设备</option>
                {scene?.devices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name} / {device.area}
                  </option>
                ))}
              </select>
              {fieldErrors.deviceId ? <span className="text-xs font-medium text-[color:var(--danger-strong)]">{fieldErrors.deviceId}</span> : null}
            </label>

            <div className="grid gap-3">
              {eventOptions.map((option) => (
                <ActionButton
                  key={option.key}
                  disabled={sending}
                  onClick={() => void sendEvent(option)}
                  variant="danger"
                  className="disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {option.label}
                </ActionButton>
              ))}
            </div>
          </div>
        </section>

        <section className="sf-panel p-5">
          <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
            {selectedDrawing ? "设备图纸模拟区" : "无图纸设备模拟区"}
          </h2>
          {selectedDrawing ? (
            <div
              className="relative mt-4 min-h-[640px] overflow-hidden rounded-[var(--radius-panel)] border border-[color:var(--border)] bg-[var(--surface-muted)]"
              style={{
                backgroundImage: `url(${selectedDrawing.fileUrl})`,
                backgroundSize: "contain",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            >
              {pointsForDrawing.map((point) => {
                const device = scene?.devices.find((item) => item.id === point.deviceId);
                const snapshot = scene?.spatialModel.statusSnapshots.find((item) => item.deviceId === point.deviceId);
                const colorClass =
                  snapshot?.status === "alarm"
                    ? "bg-[var(--danger)]"
                    : snapshot?.status === "fault"
                      ? "bg-[var(--warning)]"
                      : snapshot?.status === "offline"
                        ? "bg-[var(--text-faint)]"
                        : "bg-[var(--success)]";

                return (
                  <button
                    key={point.id}
                    type="button"
                    onClick={() => {
                      setSelectedDeviceId(point.deviceId);
                      setFieldErrors((current) => ({ ...current, deviceId: "" }));
                    }}
                    className={`group absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[color:var(--surface)] shadow-lg ${colorClass}`}
                    style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
                    title={device?.name ?? point.deviceId}
                  >
                    <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 hidden w-44 -translate-x-1/2 rounded-[12px] border border-[color:var(--border)] bg-[var(--panel-menu-bg)] px-3 py-2 text-left text-xs text-[color:var(--text-secondary)] shadow-[var(--panel-shadow-strong)] backdrop-blur-xl group-hover:block">
                      <span className="block font-semibold text-[color:var(--text-primary)]">{device?.name ?? point.deviceId}</span>
                      <span className="mt-1 block">{normalizeSnapshotStatus(snapshot?.status)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-[var(--radius-panel)] border border-[color:var(--border)] bg-[var(--surface-muted)] p-5">
              <AlertMessage>
                当前企业还没有上传图纸。这里会自动切换为无图纸测试模式，仍然可以直接选择设备并发送火警、故障、离线、恢复、心跳事件。
              </AlertMessage>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {fallbackDevices.map((device) => {
                  const snapshot = scene?.spatialModel.statusSnapshots.find((item) => item.deviceId === device.id);
                  return (
                    <button
                      key={device.id}
                      type="button"
                      onClick={() => {
                        setSelectedDeviceId(device.id);
                        setFieldErrors((current) => ({ ...current, deviceId: "" }));
                      }}
                      className={`rounded-[var(--radius-card)] border px-4 py-4 text-left transition ${
                        selectedDeviceId === device.id
                          ? "border-[color:var(--accent)] bg-[var(--accent-soft)]"
                          : "border-[color:var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-muted)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">{device.name}</p>
                          <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                            {device.area} / {device.installationLocation ?? device.location}
                          </p>
                        </div>
                        <StatusBadge status={normalizeSnapshotStatus(snapshot?.status)} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <section className="sf-panel p-5">
          <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">当前选中设备</h2>
          {selectedDevice ? (
            <div className="sf-metric-block mt-4 space-y-3 p-4">
              <div>
                <p className="text-xs text-[color:var(--text-muted)]">设备名称</p>
                <p className="mt-1 text-base font-semibold text-[color:var(--text-primary)]">{selectedDevice.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-[color:var(--text-muted)]">设备类型</p>
                  <p className="mt-1 text-[color:var(--text-primary)]">{selectedDevice.type}</p>
                </div>
                <div>
                  <p className="text-xs text-[color:var(--text-muted)]">所属区域</p>
                  <p className="mt-1 text-[color:var(--text-primary)]">{selectedDevice.area}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-[color:var(--text-muted)]">安装位置</p>
                  <p className="mt-1 text-[color:var(--text-primary)]">{selectedDevice.installationLocation ?? selectedDevice.location}</p>
                </div>
                <div>
                  <p className="text-xs text-[color:var(--text-muted)]">当前状态</p>
                  <p className="mt-1 text-[color:var(--text-primary)]">
                    {normalizeSnapshotStatus(
                      scene?.spatialModel.statusSnapshots.find((item) => item.deviceId === selectedDevice.id)?.status,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[color:var(--text-muted)]">最近上报</p>
                  <p className="mt-1 text-[color:var(--text-primary)]">{selectedDevice.lastReportAt}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-[var(--radius-card)] border border-dashed border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-8 text-center text-sm text-[color:var(--text-muted)]">
              先从左侧选择一台设备，再发送测试事件。
            </div>
          )}

          {lastResult ? (
            <div className="sf-metric-block mt-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-[color:var(--text-muted)]">最近发送结果</p>
                  <p className="mt-1 text-sm font-semibold text-[color:var(--text-primary)]">
                    {lastResult.deviceName} / {lastResult.eventLabel}
                  </p>
                </div>
                <StatusBadge status={lastResult.realtimePublished ? "已推送实时事件" : "实时推送未确认"} tone={lastResult.realtimePublished ? "success" : "warning"} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-[12px] border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2">
                  <p className="text-[color:var(--text-muted)]">报警写入</p>
                  <p className="mt-1 font-semibold text-[color:var(--text-primary)]">
                    {lastResult.alarmCreated ? "新增报警" : lastResult.duplicateSuppressed ? "原始事件已去重" : "设备状态更新"}
                  </p>
                </div>
                <div className="rounded-[12px] border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2">
                  <p className="text-[color:var(--text-muted)]">通知记录</p>
                  <p className="mt-1 font-semibold text-[color:var(--text-primary)]">
                    {latestNotificationRecords.length > 0 || lastResult.notificationCreated ? `${latestNotificationRecords.length} 条` : "未生成"}
                  </p>
                </div>
                <div className="col-span-2 rounded-[12px] border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2">
                  <p className="text-[color:var(--text-muted)]">报警 ID</p>
                  <p className="mt-1 break-all font-semibold text-[color:var(--text-primary)]">
                    {lastResult.alarmId ?? "无"}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-[color:var(--text-muted)]">处理时间：{lastResult.processedAt}</p>
            </div>
          ) : null}

          <div className="sf-metric-block mt-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">该企业最新报警中心记录</h3>
              <span className="text-xs text-[color:var(--text-muted)]">{latestAlarms.length} 条</span>
            </div>
            <div className="mt-3 space-y-2">
              {latestAlarms.length > 0 ? (
                latestAlarms.map((alarm) => (
                  <div key={alarm.id} className="rounded-[12px] border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">{alarm.alarmType}</p>
                        <p className="mt-1 truncate text-xs text-[color:var(--text-muted)]">{alarm.deviceName}</p>
                      </div>
                      <StatusBadge status={alarm.workflowStatus} />
                    </div>
                    <p className="mt-2 text-xs text-[color:var(--text-muted)]">{alarm.time}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-[12px] border border-dashed border-[color:var(--border)] px-3 py-4 text-center text-xs text-[color:var(--text-muted)]">
                  当前企业暂无报警中心记录。
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
