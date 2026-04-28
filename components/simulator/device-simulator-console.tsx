"use client";

import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
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
  { key: "alarm", label: "火警报警", eventType: "alarm" },
  { key: "fault", label: "设备故障", eventType: "fault" },
  { key: "offline", label: "设备离线", eventType: "offline" },
  { key: "recover", label: "设备恢复", eventType: "recovery" },
  { key: "heartbeat", label: "发送心跳", eventType: "heartbeat" },
] as const;

const inputClassName =
  "w-full rounded-2xl border border-[color:var(--field-border)] bg-[var(--field-bg)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100";

async function fetchScene(tenantId: string) {
  const response = await fetch(`/api/platform/tenant-scene?tenantId=${tenantId}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("LOAD_SCENE_FAILED");
  }

  return (await response.json()) as ScenePayload;
}

function normalizeSnapshotStatus(status?: string) {
  if (status === "alarm") return "报警";
  if (status === "fault") return "故障";
  if (status === "offline") return "离线";
  if (status === "maintenance") return "维修中";
  return "正常";
}

function requiredLabel(label: string) {
  return (
    <span className="flex items-center gap-1 text-sm text-[color:var(--text-secondary)]">
      {label}
      <span className="text-rose-500">*</span>
    </span>
  );
}

function fieldClassName(hasError: boolean) {
  return `${inputClassName} ${
    hasError ? "border-rose-300 text-rose-700 focus:border-rose-300 focus:ring-rose-100" : ""
  }`;
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
  const latestNotificationRecords = useMemo(
    () => scene?.notificationRecords?.filter((record) => !lastResult?.alarmId || record.alarmId === lastResult.alarmId) ?? [],
    [lastResult?.alarmId, scene?.notificationRecords],
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
      const nextScene = await fetchScene(scene!.tenant.id);
      setScene(nextScene);
      const latestAlarm =
        result.alarm_id
          ? nextScene.alarms?.find((alarm) => alarm.id === result.alarm_id) ?? null
          : nextScene.alarms?.find((alarm) => alarm.deviceId === selectedDevice!.id) ?? null;
      setLastResult({
        eventLabel: option.label,
        deviceName: selectedDevice!.name,
        processedAt: result.processed_at,
        alarmId: result.alarm_id ?? latestAlarm?.id ?? null,
        deviceStatus: result.device_status,
        alarmCreated: Boolean(result.workflow.alarm_created),
        notificationCreated: Boolean(result.workflow.notification_created),
        realtimePublished: Boolean(result.workflow.realtime_published),
        duplicateSuppressed: Boolean(result.workflow.duplicate_suppressed),
      });
      pushToast({
        message: result.workflow.alarm_created
          ? `${option.label}已创建报警，报警中心已更新。`
          : result.workflow.duplicate_suppressed
            ? `${option.label}已接收，原始事件已去重。`
            : `${option.label}已接收，设备状态已更新。`,
        tone: "success",
      });
    } catch {
      pushToast({ message: "事件已发送，但当前页面刷新企业场景失败。", tone: "warning" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={embedded ? "space-y-5" : "mx-auto min-h-screen max-w-[1800px] space-y-6 px-4 py-6"}>
      {!embedded ? (
        <section className="rounded-[28px] border border-[color:var(--border)] bg-[var(--surface)] p-6 shadow-[var(--panel-shadow)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-700">Device Test Console</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[color:var(--text-primary)]">设备模拟测试台</h1>
              <p className="mt-3 text-sm leading-7 text-[color:var(--text-muted)]">
                页面只负责发事件，不直接改报警和设备状态。所有模拟信号统一进入设备接入链路，再由报警引擎、通知、实时推送和审计日志承接。
              </p>
            </div>
            <div className="grid min-w-[320px] grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                <p className="text-xs text-[color:var(--text-muted)]">测试企业</p>
                <p className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">{scene?.tenant.name ?? "未选择"}</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                <p className="text-xs text-[color:var(--text-muted)]">图纸点位</p>
                <p className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">{pointsForDrawing.length}</p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.82fr_1.3fr_0.88fr]">
        <section className="rounded-[28px] border border-[color:var(--border)] bg-[var(--surface)] p-5 shadow-[var(--panel-shadow)]">
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
              {fieldErrors.tenantId ? <span className="text-xs font-medium text-rose-600">{fieldErrors.tenantId}</span> : null}
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
              {fieldErrors.deviceId ? <span className="text-xs font-medium text-rose-600">{fieldErrors.deviceId}</span> : null}
            </label>

            <div className="grid gap-3">
              {eventOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  disabled={sending}
                  onClick={() => void sendEvent(option)}
                  className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-[color:var(--border)] bg-[var(--surface)] p-5 shadow-[var(--panel-shadow)]">
          <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
            {selectedDrawing ? "设备图纸模拟区" : "无图纸设备模拟区"}
          </h2>
          {selectedDrawing ? (
            <div
              className="relative mt-4 min-h-[640px] overflow-hidden rounded-[28px] border border-[color:var(--border)] bg-slate-100"
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
                    ? "bg-rose-500"
                    : snapshot?.status === "fault"
                      ? "bg-amber-500"
                      : snapshot?.status === "offline"
                        ? "bg-slate-500"
                        : "bg-emerald-500";

                return (
                  <button
                    key={point.id}
                    type="button"
                    onClick={() => {
                      setSelectedDeviceId(point.deviceId);
                      setFieldErrors((current) => ({ ...current, deviceId: "" }));
                    }}
                    className={`group absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg ${colorClass}`}
                    style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
                    title={device?.name ?? point.deviceId}
                  >
                    <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 hidden w-44 -translate-x-1/2 rounded-xl border border-[color:var(--border)] bg-white px-3 py-2 text-left text-xs text-slate-700 shadow-xl group-hover:block">
                      <span className="block font-semibold text-slate-900">{device?.name ?? point.deviceId}</span>
                      <span className="mt-1 block">{normalizeSnapshotStatus(snapshot?.status)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-[28px] border border-[color:var(--border)] bg-[var(--surface-muted)] p-5">
              <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-white/70 px-4 py-3 text-sm text-[color:var(--text-muted)]">
                当前企业还没有上传图纸。这里会自动切换为无图纸测试模式，仍然可以直接选择设备并发送火警、故障、离线、恢复、心跳事件。
              </div>
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
                      className={`rounded-2xl border px-4 py-4 text-left transition ${
                        selectedDeviceId === device.id
                          ? "border-sky-200 bg-sky-50"
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
                        <span className="rounded-full border border-[color:var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-[11px] text-[color:var(--text-secondary)]">
                          {normalizeSnapshotStatus(snapshot?.status)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-[28px] border border-[color:var(--border)] bg-[var(--surface)] p-5 shadow-[var(--panel-shadow)]">
          <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">当前选中设备</h2>
          {selectedDevice ? (
            <div className="mt-4 space-y-3 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] p-4">
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
            <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-8 text-center text-sm text-[color:var(--text-muted)]">
              先从左侧选择一台设备，再发送测试事件。
            </div>
          )}

          {lastResult ? (
            <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-[color:var(--text-muted)]">最近发送结果</p>
                  <p className="mt-1 text-sm font-semibold text-[color:var(--text-primary)]">
                    {lastResult.deviceName} / {lastResult.eventLabel}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    lastResult.realtimePublished
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  {lastResult.realtimePublished ? "已推送实时事件" : "实时推送未确认"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2">
                  <p className="text-[color:var(--text-muted)]">报警写入</p>
                  <p className="mt-1 font-semibold text-[color:var(--text-primary)]">
                    {lastResult.alarmCreated ? "新增报警" : lastResult.duplicateSuppressed ? "原始事件已去重" : "设备状态更新"}
                  </p>
                </div>
                <div className="rounded-xl border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2">
                  <p className="text-[color:var(--text-muted)]">通知记录</p>
                  <p className="mt-1 font-semibold text-[color:var(--text-primary)]">
                    {latestNotificationRecords.length > 0 || lastResult.notificationCreated ? `${latestNotificationRecords.length} 条` : "未生成"}
                  </p>
                </div>
                <div className="col-span-2 rounded-xl border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2">
                  <p className="text-[color:var(--text-muted)]">报警 ID</p>
                  <p className="mt-1 break-all font-semibold text-[color:var(--text-primary)]">
                    {lastResult.alarmId ?? "无"}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-[color:var(--text-muted)]">处理时间：{lastResult.processedAt}</p>
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">该企业最新报警中心记录</h3>
              <span className="text-xs text-[color:var(--text-muted)]">{latestAlarms.length} 条</span>
            </div>
            <div className="mt-3 space-y-2">
              {latestAlarms.length > 0 ? (
                latestAlarms.map((alarm) => (
                  <div key={alarm.id} className="rounded-xl border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2">
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
                <div className="rounded-xl border border-dashed border-[color:var(--border)] px-3 py-4 text-center text-xs text-[color:var(--text-muted)]">
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
