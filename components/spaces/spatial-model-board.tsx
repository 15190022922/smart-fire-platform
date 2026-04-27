"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SectionCard } from "@/components/section-card";
import { getTenantEventBus } from "@/lib/realtime/event-bus";
import type {
  DeviceStatusSnapshotRecord,
  TenantDevicePointRecord,
  TenantDrawingRecord,
  TenantFloorRecord,
  TenantSpatialModel,
} from "@/types/hardware";
import type { TenantDeviceRecord } from "@/types/saas";

const inputClassName =
  "sf-input h-11 px-4 text-sm";

type UploadFormState = {
  floorId: string;
  name: string;
  version: string;
  fileName: string;
  fileUrl: string;
  width: number;
  height: number;
};

function gatewayStatusLabel(status: string) {
  if (status === "online") return "在线";
  if (status === "fault") return "故障";
  if (status === "offline") return "离线";
  return status;
}

function drawingStatusLabel(status: string) {
  if (status === "published") return "已发布";
  if (status === "draft") return "草稿";
  if (status === "archived") return "归档";
  return status;
}

function eventTypeLabel(type: string) {
  if (type === "alarm") return "报警";
  if (type === "fault") return "故障";
  if (type === "recover") return "恢复";
  if (type === "heartbeat") return "心跳";
  if (type === "status_change") return "状态变化";
  return type;
}

function runtimeStatusLabel(status: string) {
  if (status === "normal") return "正常";
  if (status === "alarm") return "报警";
  if (status === "fault") return "故障";
  if (status === "offline") return "离线";
  if (status === "maintenance") return "维修中";
  return status;
}

function pointStyleFromStatus(status?: string) {
  if (status === "报警") return "alarm";
  if (status === "故障") return "fault";
  if (status === "离线") return "offline";
  return "normal";
}

function toneClass(value: string) {
  if (value === "alarm" || value === "critical") return "bg-rose-50 text-rose-700 border-rose-200";
  if (value === "fault" || value === "warning") return "bg-amber-50 text-amber-700 border-amber-200";
  if (value === "online" || value === "normal" || value === "published" || value === "info") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (value === "offline" || value === "archived") return "bg-slate-100 text-slate-700 border-slate-200";
  return "bg-[var(--surface-muted)] text-[color:var(--text-secondary)] border-[color:var(--border)]";
}

async function readFileAsDataUrl(file: File) {
  return new Promise<{ fileUrl: string; width: number; height: number }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("图片解析失败"));
      image.onload = () => {
        resolve({
          fileUrl: String(reader.result),
          width: image.width,
          height: image.height,
        });
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function formatFloorLabel(floor: TenantFloorRecord | undefined, drawing?: TenantDrawingRecord) {
  if (!floor) {
    return drawing?.name ?? "未指定楼层";
  }
  return `${floor.name}${drawing ? ` / ${drawing.name}` : ""}`;
}

function findSnapshot(deviceId: string, snapshots: DeviceStatusSnapshotRecord[]) {
  return snapshots.find((item) => item.deviceId === deviceId) ?? null;
}

function groupDevicesByFloor(devices: TenantDeviceRecord[], floors: TenantFloorRecord[]) {
  const orderedFloorIds = floors.map((floor) => floor.id);
  const buckets = new Map<string, TenantDeviceRecord[]>();

  for (const device of devices) {
    const key = device.floorId ?? `area:${device.area}`;
    const current = buckets.get(key) ?? [];
    current.push(device);
    buckets.set(key, current);
  }

  return Array.from(buckets.entries())
    .sort(([left], [right]) => {
      const leftIndex = orderedFloorIds.indexOf(left);
      const rightIndex = orderedFloorIds.indexOf(right);
      if (leftIndex >= 0 && rightIndex >= 0) {
        return leftIndex - rightIndex;
      }
      if (leftIndex >= 0) {
        return -1;
      }
      if (rightIndex >= 0) {
        return 1;
      }
      return left.localeCompare(right, "zh-CN");
    })
    .map(([key, items]) => ({
      key,
      label: floors.find((floor) => floor.id === key)?.name ?? key.replace("area:", ""),
      devices: items.sort((a, b) => a.name.localeCompare(b.name, "zh-CN")),
    }));
}

export function SpatialModelBoard({
  initialModel,
  devices,
}: {
  initialModel: TenantSpatialModel;
  devices: TenantDeviceRecord[];
}) {
  const [model, setModel] = useState(initialModel);
  const [deviceList, setDeviceList] = useState(devices);
  const [uploading, setUploading] = useState(false);
  const [savingPoint, setSavingPoint] = useState(false);
  const [selectedFloorId, setSelectedFloorId] = useState(initialModel.floors[0]?.id ?? "");
  const [selectedDrawingId, setSelectedDrawingId] = useState(initialModel.drawings[0]?.id ?? "");
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [uploadForm, setUploadForm] = useState<UploadFormState>({
    floorId: initialModel.floors[0]?.id ?? "",
    name: "",
    version: "v1.0",
    fileName: "",
    fileUrl: "",
    width: 0,
    height: 0,
  });
  const mapRef = useRef<HTMLDivElement | null>(null);
  const isRefreshingRef = useRef(false);

  const selectedDrawing = useMemo(
    () => model.drawings.find((drawing) => drawing.id === selectedDrawingId) ?? null,
    [model.drawings, selectedDrawingId],
  );
  const selectedFloor = useMemo(
    () => model.floors.find((floor) => floor.id === (selectedDrawing?.floorId ?? selectedFloorId)) ?? null,
    [model.floors, selectedDrawing?.floorId, selectedFloorId],
  );
  const pointsForDrawing = useMemo(
    () => model.devicePoints.filter((point) => point.drawingId === selectedDrawingId),
    [model.devicePoints, selectedDrawingId],
  );
  const mappedDeviceIds = useMemo(() => new Set(model.devicePoints.map((item) => item.deviceId)), [model.devicePoints]);
  const unmappedDevices = useMemo(
    () => deviceList.filter((device) => !mappedDeviceIds.has(device.id)),
    [deviceList, mappedDeviceIds],
  );
  const availableDevices = selectedFloor
    ? deviceList.filter((device) => !device.floorId || device.floorId === selectedFloor.id || device.id === selectedDeviceId)
    : deviceList;
  const hasDrawings = model.drawings.length > 0;
  const fallbackGroups = useMemo(() => groupDevicesByFloor(deviceList, model.floors), [deviceList, model.floors]);

  const refresh = useCallback(async () => {
    if (isRefreshingRef.current) {
      return;
    }

    isRefreshingRef.current = true;
    const [spatialResponse, deviceResponse] = await Promise.all([
      fetch("/api/tenant/spatial-model", { cache: "no-store" }),
      fetch("/api/tenant/devices", { cache: "no-store" }),
    ]);

    try {
      if (spatialResponse.ok) {
        const nextModel = (await spatialResponse.json()) as TenantSpatialModel;
        setModel(nextModel);
      }

      if (deviceResponse.ok) {
        const result = (await deviceResponse.json()) as { devices: TenantDeviceRecord[] };
        setDeviceList(result.devices ?? []);
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

    const handleFocus = () => {
      void refresh();
    };

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

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const parsed = await readFileAsDataUrl(file);
    setUploadForm((current) => ({
      ...current,
      fileName: file.name,
      fileUrl: parsed.fileUrl,
      width: parsed.width,
      height: parsed.height,
      name: current.name || file.name.replace(/\.[^.]+$/, ""),
    }));
  }

  async function handleUploadDrawing() {
    if (!uploadForm.floorId || !uploadForm.name || !uploadForm.fileUrl) {
      setMessage("请先选择楼层并上传图纸文件。");
      return;
    }

    setUploading(true);
    setMessage(null);

    const response = await fetch("/api/tenant/drawings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        floorId: uploadForm.floorId,
        name: uploadForm.name,
        fileUrl: uploadForm.fileUrl,
        width: uploadForm.width,
        height: uploadForm.height,
        version: uploadForm.version,
        status: "published",
      }),
    });

    setUploading(false);

    if (!response.ok) {
      setMessage("图纸上传失败。");
      return;
    }

    const result = (await response.json()) as { drawing: TenantDrawingRecord };
    setModel((current) => ({
      ...current,
      summary: {
        ...current.summary,
        drawingCount: current.summary.drawingCount + 1,
      },
      drawings: [result.drawing, ...current.drawings],
    }));
    setSelectedFloorId(result.drawing.floorId);
    setSelectedDrawingId(result.drawing.id);
    setUploadForm({
      floorId: result.drawing.floorId,
      name: "",
      version: "v1.0",
      fileName: "",
      fileUrl: "",
      width: 0,
      height: 0,
    });
    setMessage("图纸已上传，现在可以开始布点。");
  }

  async function handleDeleteDrawing(drawingId: string) {
    if (!window.confirm("确认删除这张图纸及其关联点位吗？")) {
      return;
    }

    const removedPoints = model.devicePoints.filter((point) => point.drawingId === drawingId).length;
    const response = await fetch(`/api/tenant/drawings?id=${drawingId}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage("图纸删除失败。");
      return;
    }

    setModel((current) => {
      const drawings = current.drawings.filter((drawing) => drawing.id !== drawingId);
      const devicePoints = current.devicePoints.filter((point) => point.drawingId !== drawingId);
      return {
        ...current,
        summary: {
          ...current.summary,
          drawingCount: Math.max(current.summary.drawingCount - 1, 0),
          mappedDeviceCount: new Set(devicePoints.map((item) => item.deviceId)).size,
          unmappedDeviceCount: Math.max(deviceList.length - new Set(devicePoints.map((item) => item.deviceId)).size, 0),
        },
        drawings,
        devicePoints,
      };
    });

    if (selectedDrawingId === drawingId) {
      const nextDrawing = model.drawings.find((item) => item.id !== drawingId);
      setSelectedDrawingId(nextDrawing?.id ?? "");
      setSelectedFloorId(nextDrawing?.floorId ?? selectedFloorId);
    }

    setMessage(`图纸已删除，同时移除了 ${removedPoints} 个点位。`);
  }

  async function handlePlacePoint(event: React.MouseEvent<HTMLDivElement>) {
    if (!selectedDrawing || !selectedDeviceId || !mapRef.current) {
      setMessage("请先选择图纸和设备，再点击画布布点。");
      return;
    }

    const rect = mapRef.current.getBoundingClientRect();
    const x = Number(((event.clientX - rect.left) / rect.width).toFixed(4));
    const y = Number(((event.clientY - rect.top) / rect.height).toFixed(4));
    const device = deviceList.find((item) => item.id === selectedDeviceId);

    if (!device) {
      setMessage("未找到对应设备。");
      return;
    }

    setSavingPoint(true);
    setMessage(null);

    const response = await fetch("/api/tenant/device-points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: device.id,
        floorId: selectedDrawing.floorId,
        drawingId: selectedDrawing.id,
        x,
        y,
        icon: device.type,
        statusStyle: pointStyleFromStatus(device.status),
      }),
    });

    setSavingPoint(false);

    if (!response.ok) {
      setMessage("点位保存失败。");
      return;
    }

    const result = (await response.json()) as { point: TenantDevicePointRecord };
    setModel((current) => {
      const devicePoints = [
        result.point,
        ...current.devicePoints.filter((item) => item.id !== result.point.id && item.deviceId !== result.point.deviceId),
      ];
      const mappedCount = new Set(devicePoints.map((item) => item.deviceId)).size;
      return {
        ...current,
        summary: {
          ...current.summary,
          mappedDeviceCount: mappedCount,
          unmappedDeviceCount: Math.max(deviceList.length - mappedCount, 0),
        },
        devicePoints,
      };
    });
    setMessage(`已为设备「${device.name}」保存点位。`);
  }

  async function handleDeletePoint(pointId: string) {
    const response = await fetch(`/api/tenant/device-points?id=${pointId}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage("点位删除失败。");
      return;
    }

    setModel((current) => {
      const devicePoints = current.devicePoints.filter((item) => item.id !== pointId);
      const mappedCount = new Set(devicePoints.map((item) => item.deviceId)).size;
      return {
        ...current,
        summary: {
          ...current.summary,
          mappedDeviceCount: mappedCount,
          unmappedDeviceCount: Math.max(deviceList.length - mappedCount, 0),
        },
        devicePoints,
      };
    });
    setMessage("点位已删除。");
  }

  return (
    <div className="space-y-2.5">
      <section className="sf-panel relative overflow-hidden rounded-[20px] p-4 sm:p-5">
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent_0%,rgba(72,106,141,0.34)_48%,transparent_100%)]" />
        <div className="flex flex-col gap-3 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(560px,auto)] xl:items-end xl:gap-4">
          <div className="max-w-[860px]">
            <p className="sf-label text-[color:var(--accent-strong)]">Spatial Readiness</p>
            <h1 className="mt-2.5 text-[26px] font-semibold tracking-[-0.03em] text-[color:var(--text-primary)] sm:text-[28px]">
              图纸上传与布点编辑器
            </h1>
            <p className="mt-2 text-[13px] leading-6 text-[color:var(--text-secondary)] sm:text-sm">
              现在开始把企业自己的楼层图和设备点位真正落到系统里。后续首页地图、实时状态和硬件接入都直接建立在这套空间模型上。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:min-w-[560px] xl:justify-self-end">
            <div className="sf-metric-block px-3.5 py-2.5">
              <p className="sf-label">已映射设备</p>
              <p className="mt-1.5 text-[1.45rem] font-semibold leading-none tracking-[-0.03em] text-[color:var(--text-primary)]">
                {model.summary.mappedDeviceCount}
              </p>
            </div>
            <div className="sf-metric-block px-3.5 py-2.5">
              <p className="sf-label">待布点设备</p>
              <p className="mt-1.5 text-[1.45rem] font-semibold leading-none tracking-[-0.03em] text-[color:var(--text-primary)]">
                {model.summary.unmappedDeviceCount}
              </p>
            </div>
            <div className="sf-metric-block px-3.5 py-2.5">
              <p className="sf-label">在线网关</p>
              <p className="mt-1.5 text-[1.45rem] font-semibold leading-none tracking-[-0.03em] text-[color:var(--text-primary)]">
                {model.summary.onlineGatewayCount}/{model.summary.gatewayCount}
              </p>
            </div>
            <div className="sf-metric-block px-3.5 py-2.5">
              <p className="sf-label">最近原始事件</p>
              <p className="mt-2 text-sm font-semibold text-[color:var(--text-primary)]">{model.summary.recentEventCount} 条</p>
            </div>
          </div>
        </div>
      </section>

      {message ? (
        <div className="rounded-[14px] border border-[color:rgba(72,106,141,0.18)] bg-[color:var(--accent-soft)] px-4 py-3 text-sm text-[color:var(--accent-strong)]">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.45fr_0.8fr]">
        <SectionCard
          title="上传楼层图纸"
          description="先选楼层，再上传图片。当前版本先把图纸文件以 data URL 演示方式存入数据库，后续接 OSS 或对象存储时只需替换文件存储层。"
        >
          <div className="space-y-3">
            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--text-secondary)]">所属楼层</span>
              <select
                value={uploadForm.floorId}
                onChange={(event) => setUploadForm((current) => ({ ...current, floorId: event.target.value }))}
                className={inputClassName}
              >
                <option value="">请选择楼层</option>
                {model.floors.map((floor) => (
                  <option key={floor.id} value={floor.id}>
                    {floor.name} / {floor.code}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--text-secondary)]">图纸名称</span>
              <input
                value={uploadForm.name}
                onChange={(event) => setUploadForm((current) => ({ ...current, name: event.target.value }))}
                className={inputClassName}
                placeholder="例如：1号厂房 2层消防图"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--text-secondary)]">版本号</span>
              <input
                value={uploadForm.version}
                onChange={(event) => setUploadForm((current) => ({ ...current, version: event.target.value }))}
                className={inputClassName}
                placeholder="例如：v1.0"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--text-secondary)]">图纸文件</span>
              <input type="file" accept="image/*" onChange={handleFileSelect} className={inputClassName} />
            </label>

            <div className="sf-metric-block px-4 py-3 text-sm text-[color:var(--text-secondary)]">
              {uploadForm.fileName
                ? `${uploadForm.fileName} / ${uploadForm.width} × ${uploadForm.height}`
                : "尚未选择图纸文件"}
            </div>

            <button
              type="button"
              onClick={handleUploadDrawing}
              disabled={uploading}
              className="sf-button sf-button-primary h-11 w-full px-4 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? "正在上传..." : "上传图纸"}
            </button>
          </div>

          <div className="mt-6 space-y-3">
            {model.drawings.map((drawing) => {
              const floor = model.floors.find((item) => item.id === drawing.floorId);
              const pointCount = model.devicePoints.filter((item) => item.drawingId === drawing.id).length;
              return (
                <div
                  key={drawing.id}
                  className={`px-4 py-3 ${
                    selectedDrawingId === drawing.id
                      ? "sf-list-row border-[color:var(--accent)] bg-[color:var(--accent-soft)] shadow-[var(--panel-shadow)]"
                      : "sf-list-row"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDrawingId(drawing.id);
                        setSelectedFloorId(drawing.floorId);
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">{drawing.name}</p>
                      <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                        {formatFloorLabel(floor, drawing)} · {drawing.version}
                      </p>
                    </button>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${toneClass(drawing.status)}`}>
                        {drawingStatusLabel(drawing.status)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteDrawing(drawing.id)}
                        className="sf-button sf-button-danger h-8 px-3 text-xs"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-[color:var(--text-muted)]">{pointCount} 个点位</p>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          title="布点编辑器"
          description="先选图纸和设备，然后直接点击画布。当前设备如果已有点位，会移动到新的位置而不是重复新增。"
          extra={
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-[color:var(--border-soft)] bg-[color:rgba(255,255,255,0.84)] px-3 py-1 text-xs text-[color:var(--text-secondary)]">
                当前图纸：{selectedDrawing?.name ?? "未选择"}
              </span>
              <span className="rounded-full border border-[color:var(--border-soft)] bg-[color:rgba(255,255,255,0.84)] px-3 py-1 text-xs text-[color:var(--text-secondary)]">
                点位：{pointsForDrawing.length}
              </span>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <label className="block space-y-2">
                <span className="text-sm text-[color:var(--text-secondary)]">当前楼层</span>
                <select
                  value={selectedFloorId}
                  onChange={(event) => {
                    const floorId = event.target.value;
                    setSelectedFloorId(floorId);
                    const drawing = model.drawings.find((item) => item.floorId === floorId);
                    setSelectedDrawingId(drawing?.id ?? "");
                  }}
                  className={inputClassName}
                >
                  {model.floors.map((floor) => (
                    <option key={floor.id} value={floor.id}>
                      {floor.name} / {floor.code}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm text-[color:var(--text-secondary)]">待布点设备</span>
                <select
                  value={selectedDeviceId}
                  onChange={(event) => setSelectedDeviceId(event.target.value)}
                  className={inputClassName}
                >
                  <option value="">请选择设备</option>
                  {availableDevices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.name} / {device.status}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {selectedDrawing ? (
              <div
                ref={mapRef}
                onClick={handlePlacePoint}
                className="relative min-h-[420px] overflow-hidden rounded-[20px] border border-[color:var(--border)] bg-[linear-gradient(180deg,#eef3f8_0%,#e5edf5_100%)] sm:min-h-[560px]"
                style={{
                  backgroundImage: `url(${selectedDrawing.fileUrl})`,
                  backgroundSize: "contain",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                  cursor: selectedDeviceId ? "crosshair" : "not-allowed",
                }}
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.32),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0))]" />
                <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-[color:rgba(255,255,255,0.52)] bg-white/82 px-3 py-1 text-xs text-[color:var(--text-secondary)] shadow-sm backdrop-blur-sm">
                  点击图纸空白处完成布点
                </div>

                {pointsForDrawing.map((point) => {
                  const device = deviceList.find((item) => item.id === point.deviceId);
                  const snapshot = findSnapshot(point.deviceId, model.statusSnapshots);
                  const colorClass =
                    point.statusStyle === "alarm"
                      ? "bg-rose-500"
                      : point.statusStyle === "fault"
                        ? "bg-amber-500"
                        : point.statusStyle === "offline"
                          ? "bg-slate-500"
                          : "bg-emerald-500";

                  return (
                    <button
                      key={point.id}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedDeviceId(point.deviceId);
                      }}
                      className={`group absolute h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_6px_16px_rgba(15,23,42,0.18)] ${colorClass}`}
                      style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
                      title={`${device?.name ?? point.deviceId} / ${runtimeStatusLabel(snapshot?.status ?? "normal")}`}
                    >
                      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 hidden w-44 -translate-x-1/2 rounded-[14px] border border-[color:var(--border)] bg-white/96 px-3 py-2 text-left text-xs text-slate-700 shadow-[var(--panel-shadow-strong)] group-hover:block">
                        <span className="block font-semibold text-slate-900">{device?.name ?? point.deviceId}</span>
                        <span className="mt-1 block">{device?.type ?? "未定义类型"}</span>
                        <span className="mt-1 block">{runtimeStatusLabel(snapshot?.status ?? "normal")}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3 rounded-[20px] border border-dashed border-[color:var(--border)] bg-[var(--surface-muted)] p-5">
                <div className="rounded-[16px] border border-[color:var(--border-soft)] bg-white/70 px-4 py-3 text-sm text-[color:var(--text-muted)]">
                  当前企业还没有图纸。系统已切换到无图纸拓扑视图，便于先完成设备接入测试和区域核对。正式运行时再补图纸和坐标布点即可。
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  {fallbackGroups.map((group) => (
                    <div key={group.key} className="sf-panel-subtle p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[color:var(--text-primary)]">{group.label}</p>
                          <p className="mt-1 text-xs text-[color:var(--text-muted)]">{group.devices.length} 台设备</p>
                        </div>
                        <span className="rounded-full border border-[color:rgba(72,106,141,0.18)] bg-[color:var(--accent-soft)] px-3 py-1 text-xs text-[color:var(--accent-strong)]">无图纸模式</span>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {group.devices.map((device) => {
                          const snapshot = findSnapshot(device.id, model.statusSnapshots);
                          return (
                            <button
                              key={device.id}
                              type="button"
                              onClick={() => setSelectedDeviceId(device.id)}
                              className={`px-4 py-3 text-left ${
                                selectedDeviceId === device.id
                                  ? "sf-list-row border-[color:var(--accent)] bg-[color:var(--accent-soft)] shadow-[var(--panel-shadow)]"
                                  : "sf-list-row"
                              }`}
                            >
                              <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">{device.name}</p>
                              <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                                {device.type} / {device.installationLocation ?? device.location}
                              </p>
                              <div className="mt-2 flex items-center justify-between gap-3">
                                <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${toneClass(pointStyleFromStatus(device.status))}`}>
                                  {device.status}
                                </span>
                                <span className="text-[11px] text-[color:var(--text-muted)]">
                                  {runtimeStatusLabel(snapshot?.status ?? "normal")}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-[16px] border border-[color:var(--border-soft)] bg-[linear-gradient(180deg,rgba(248,251,254,0.98)_0%,rgba(255,255,255,0.98)_100%)] px-4 py-3 text-sm text-[color:var(--text-secondary)]">
              {!hasDrawings
                ? "当前为无图纸模式，可先核对设备归属和实时状态；后续上传图纸后再进入正式布点。"
                : savingPoint
                ? "正在保存点位..."
                : selectedDeviceId
                  ? "已选择设备，点击图纸即可完成布点。"
                  : "先在上方选择设备，再点击图纸。"}
            </div>
          </div>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard
            title="点位清单"
            description="用于快速检查当前图纸上的点位绑定情况。删除点位不会删除设备本身。"
          >
            <div className="space-y-3">
              {pointsForDrawing.length === 0 ? (
                <div className="rounded-[16px] border border-[color:var(--border-soft)] bg-[var(--surface-muted)] px-4 py-5 text-sm text-[color:var(--text-muted)]">
                  当前图纸还没有点位。
                </div>
              ) : (
                pointsForDrawing.map((point) => {
                  const device = deviceList.find((item) => item.id === point.deviceId);
                  const snapshot = findSnapshot(point.deviceId, model.statusSnapshots);
                  return (
                    <div
                      key={point.id}
                      className="sf-list-row px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                            {device?.name ?? point.deviceId}
                          </p>
                          <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                            {device?.type ?? "未定义类型"} · x {point.x.toFixed(3)} / y {point.y.toFixed(3)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeletePoint(point.id)}
                          className="sf-button sf-button-danger h-8 px-3 text-xs"
                        >
                          删除
                        </button>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${toneClass(point.statusStyle)}`}>
                          {runtimeStatusLabel(snapshot?.status ?? "normal")}
                        </span>
                        <span className="text-xs text-[color:var(--text-muted)]">
                          最近更新：{point.updatedAt}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="待布点设备"
            description="这部分设备还没有进入任何图纸点位。后续真实硬件到位后，应先完成空间绑定，再让首页和报警中心引用这些点位。"
          >
            <div className="space-y-3">
              {unmappedDevices.length === 0 ? (
                <div className="rounded-[16px] border border-[color:var(--border-soft)] bg-[var(--surface-muted)] px-4 py-5 text-sm text-[color:var(--text-muted)]">
                  当前设备都已完成布点。
                </div>
              ) : (
                unmappedDevices.map((device) => (
                  <button
                    key={device.id}
                    type="button"
                    onClick={() => setSelectedDeviceId(device.id)}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left ${
                      selectedDeviceId === device.id
                        ? "sf-list-row border-[color:var(--accent)] bg-[color:var(--accent-soft)] shadow-[var(--panel-shadow)]"
                        : "sf-list-row"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">{device.name}</p>
                      <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                        {device.type} · {device.location}
                      </p>
                    </div>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${toneClass(pointStyleFromStatus(device.status))}`}>
                      {device.status}
                    </span>
                  </button>
                ))
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="实时接入准备"
            description="这里保留当前网关、原始事件和状态快照，后面接 MQTT/TCP 后可以直接接上。"
          >
            <div className="space-y-3">
              {model.gateways.map((gateway) => (
                <div key={gateway.id} className="sf-list-row px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--text-primary)]">{gateway.name}</p>
                      <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                        {gateway.protocol} · {gateway.serialNumber}
                      </p>
                    </div>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${toneClass(gateway.status)}`}>
                      {gatewayStatusLabel(gateway.status)}
                    </span>
                  </div>
                </div>
              ))}
              <div className="rounded-[16px] border border-[color:var(--border-soft)] bg-[linear-gradient(180deg,rgba(248,251,254,0.98)_0%,rgba(255,255,255,0.98)_100%)] px-4 py-3">
                <p className="text-sm font-semibold text-[color:var(--text-primary)]">最近原始事件</p>
                <div className="mt-3 space-y-2">
                  {model.recentEvents.slice(0, 4).map((event) => (
                    <div key={event.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-[color:var(--text-primary)]">
                        {event.deviceId} / {eventTypeLabel(event.eventType)}
                      </span>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 ${toneClass(event.eventLevel)}`}>
                        {event.eventLevel}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
