"use client";

import { useMemo, useRef, useState } from "react";
import { DrawingSurface } from "@/components/drawings/drawing-surface";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/cn";
import { normalizeDeviceStatusText } from "@/packages/shared/src/legacy-text";
import type { TenantDrawingRecord } from "@/types/hardware";
import type { AlarmPoint, AlarmPointStatus, FloorZone } from "@/types/platform";

const WORLD_WIDTH = 2200;
const WORLD_HEIGHT = 1320;
const MIN_SCALE = 0.5;
const MAX_SCALE = 2;

type CadModel = {
  id: string;
  name: string;
  width: number;
  height: number;
  viewBox: { x: number; y: number; width: number; height: number };
  layers: CadLayer[];
};

type CadLayer = {
  id: string;
  name: string;
  visible: boolean;
  type: "wall" | "road" | "room" | "door" | "pipe" | "escape" | "custom";
  paths: CadPath[];
};

type CadPath = {
  id: string;
  d: string;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
};

const zoneLayout: Record<
  string,
  { x: number; y: number; width: number; height: number; labelTone: string }
> = {
  "zone-1": { x: 220, y: 210, width: 620, height: 360, labelTone: "text-[var(--accent-strong)]" },
  "zone-2": { x: 1280, y: 170, width: 560, height: 380, labelTone: "text-[var(--info)]" },
  "zone-3": { x: 320, y: 860, width: 760, height: 290, labelTone: "text-[color:var(--text-secondary)]" },
  "zone-4": { x: 1420, y: 860, width: 420, height: 260, labelTone: "text-[var(--success-strong)]" },
};

const statusFilters: Array<{ label: AlarmPointStatus; status: AlarmPointStatus }> = [
  { label: "正常", status: "正常" },
  { label: "报警", status: "报警" },
  { label: "故障", status: "故障" },
  { label: "离线", status: "离线" },
];

const markerTone: Record<string, string> = {
  正常: "sf-floating-marker-normal",
  报警: "sf-floating-marker-danger",
  故障: "sf-floating-marker-warning",
  离线: "sf-floating-marker-offline",
};

type HoveredPoint = {
  point: AlarmPoint;
  x: number;
  y: number;
};

type ProjectedPoint = {
  point: AlarmPoint;
  zoneId: string;
  groundX: number;
  groundY: number;
  markerX: number;
  markerY: number;
  status: AlarmPointStatus;
};

export type PublishedDrawingScene = {
  drawing: TenantDrawingRecord;
  areaId: string;
  areaLabel: string;
  floorId: string;
  floorLabel: string;
  points: AlarmPoint[];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizePointStatus(status: string): AlarmPointStatus {
  const normalized = normalizeDeviceStatusText(status);
  if (normalized === "报警") return "报警";
  if (normalized === "故障") return "故障";
  if (normalized === "离线") return "离线";
  return "正常";
}

function getWorldPointPosition(zoneId: string, point: AlarmPoint) {
  const frame = zoneLayout[zoneId] ?? zoneLayout["zone-1"];
  return {
    x: frame.x + (point.x / 100) * frame.width,
    y: frame.y + (point.y / 100) * frame.height,
  };
}

function rectPath(x: number, y: number, width: number, height: number) {
  return `M ${x} ${y} H ${x + width} V ${y + height} H ${x} Z`;
}

function centerOf(zoneId: string) {
  const frame = zoneLayout[zoneId] ?? zoneLayout["zone-1"];
  return { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
}

function buildCadModel(zones: FloorZone[]): CadModel {
  const roomPaths = zones.map((zone) => {
    const frame = zoneLayout[zone.id] ?? zoneLayout["zone-1"];
    return {
      id: `${zone.id}-room`,
      d: rectPath(frame.x, frame.y, frame.width, frame.height),
      strokeWidth: 2,
    };
  });

  const wallPaths = zones.flatMap((zone) => {
    const frame = zoneLayout[zone.id] ?? zoneLayout["zone-1"];
    const left = frame.x + frame.width * 0.22;
    const right = frame.x + frame.width * 0.61;
    const upper = frame.y + frame.height * 0.3;
    const lower = frame.y + frame.height * 0.68;
    return [
      { id: `${zone.id}-wall-v1`, d: `M ${left} ${frame.y + 18} V ${frame.y + frame.height - 18}` },
      { id: `${zone.id}-wall-v2`, d: `M ${right} ${frame.y + 18} V ${frame.y + frame.height - 18}` },
      { id: `${zone.id}-wall-h1`, d: `M ${frame.x + 18} ${upper} H ${frame.x + frame.width - 18}` },
      { id: `${zone.id}-wall-h2`, d: `M ${frame.x + 18} ${lower} H ${frame.x + frame.width - 18}` },
    ];
  });

  const roadPaths = [
    { id: "road-main", d: `M 160 636 H 2020`, strokeWidth: 56 },
    { id: "road-vertical", d: `M 1076 120 V 1160`, strokeWidth: 46 },
    { id: "road-zone-1-2", d: `M ${centerOf("zone-1").x} ${centerOf("zone-1").y} L ${centerOf("zone-2").x} ${centerOf("zone-2").y}`, strokeWidth: 20 },
    { id: "road-zone-3-4", d: `M ${centerOf("zone-3").x} ${centerOf("zone-3").y} L ${centerOf("zone-4").x} ${centerOf("zone-4").y}`, strokeWidth: 20 },
  ];

  return {
    id: "dashboard-cad-fallback",
    name: "消防可视化拓扑图",
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    viewBox: { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT },
    layers: [
      { id: "roads", name: "道路与通道", visible: true, type: "road", paths: roadPaths },
      { id: "rooms", name: "楼层轮廓", visible: true, type: "room", paths: roomPaths },
      { id: "walls", name: "内部墙线", visible: true, type: "wall", paths: wallPaths },
    ],
  };
}

function CadSvg({ cadModel }: { cadModel: CadModel }) {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox={`${cadModel.viewBox.x} ${cadModel.viewBox.y} ${cadModel.viewBox.width} ${cadModel.viewBox.height}`}
      role="img"
      aria-label={cadModel.name}
    >
      {cadModel.layers
        .filter((layer) => layer.visible)
        .map((layer) => (
          <g key={layer.id} className={`sf-cad-layer sf-cad-layer-${layer.type}`}>
            {layer.paths.map((path) => (
              <path
                key={path.id}
                d={path.d}
                stroke={path.stroke}
                fill={path.fill}
                strokeWidth={path.strokeWidth}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        ))}
    </svg>
  );
}

function PublishedDrawingMapPanel({
  scenes,
  scene,
  onSelectScene,
}: {
  scenes: PublishedDrawingScene[];
  scene: PublishedDrawingScene;
  onSelectScene: (drawingId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<HoveredPoint | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<AlarmPoint | null>(null);
  const [activeStatuses, setActiveStatuses] = useState<AlarmPointStatus[]>(["正常", "报警", "故障", "离线"]);

  const visiblePoints = useMemo(
    () => scene.points.filter((point) => activeStatuses.includes(normalizePointStatus(point.status))),
    [activeStatuses, scene.points],
  );

  function toggleStatus(status: AlarmPointStatus) {
    setActiveStatuses((current) => {
      const next = current.includes(status) ? current.filter((item) => item !== status) : [...current, status];
      return next.length > 0 ? next : ["正常", "报警", "故障", "离线"];
    });
  }

  function updateHoverCard(point: AlarmPoint, clientX: number, clientY: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHoveredPoint({
      point,
      x: clamp(clientX - rect.left + 16, 16, rect.width - 300),
      y: clamp(clientY - rect.top - 12, 16, rect.height - 170),
    });
  }

  return (
    <section className="sf-cad-screen relative h-full min-h-[420px] overflow-hidden rounded-[26px] lg:min-h-0">
      <div className="sf-glass absolute inset-x-0 top-0 z-30 flex h-11 min-h-11 items-center gap-2 overflow-hidden rounded-b-none rounded-t-[26px] border-x-0 border-t-0 px-3 py-1.5">
        <div className="flex shrink-0 flex-nowrap items-center gap-1.5 text-xs">
          {statusFilters.map((filter) => (
            <button
              key={filter.status}
              type="button"
              onClick={() => toggleStatus(filter.status)}
              className={cn(
                "sf-button px-2.5 py-1 text-xs",
                activeStatuses.includes(filter.status)
                  ? "border-[color:var(--border-soft)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                  : "border-[color:var(--border)] bg-[var(--panel-cell-bg)] text-[color:var(--text-secondary)] hover:bg-[var(--surface-muted)]",
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="flex min-w-0 flex-nowrap items-center gap-1.5">
          <PublishedDrawingSceneSelector scenes={scenes} activeScene={scene} onSelect={onSelectScene} />
        </div>
      </div>

      <div ref={containerRef} className="relative h-full min-h-0 overflow-hidden select-none">
        <div className="absolute inset-0 bg-[image:var(--cad-overlay-grid)] bg-[size:46px_46px]" />
        <DrawingSurface drawing={scene.drawing}>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,var(--panel-body-bg),transparent_34%,color-mix(in_srgb,var(--text-primary)_12%,transparent))]" />

          {visiblePoints.map((point) => {
            const status = normalizePointStatus(point.status);
            return (
              <button
                key={point.id}
                type="button"
                aria-label={point.deviceName}
                className={cn(
                  "sf-floating-marker pointer-events-auto",
                  markerTone[status] ?? markerTone["正常"],
                  selectedPoint?.id === point.id ? "sf-floating-marker-selected" : "",
                )}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
                onMouseEnter={(event) => updateHoverCard(point, event.clientX, event.clientY)}
                onMouseMove={(event) => updateHoverCard(point, event.clientX, event.clientY)}
                onMouseLeave={() => setHoveredPoint(null)}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedPoint(point);
                }}
              />
            );
          })}
        </DrawingSurface>

        {selectedPoint ? (
          <div className="sf-glass-strong absolute bottom-3 left-3 right-3 z-30 rounded-[16px] p-4 sm:left-4 sm:right-auto sm:w-[320px]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">{selectedPoint.deviceName}</p>
                <p className="mt-1 truncate text-xs text-[color:var(--text-muted)]">{selectedPoint.deviceType}</p>
              </div>
              <button type="button" onClick={() => setSelectedPoint(null)} className="sf-button sf-button-secondary px-2.5 py-1 text-[11px]">
                关闭
              </button>
            </div>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-[color:var(--text-muted)]">所在位置</dt>
                <dd className="max-w-[170px] text-right text-[color:var(--text-primary)]">{selectedPoint.positionLabel}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[color:var(--text-muted)]">当前状态</dt>
                <dd className="text-right">
                  <StatusBadge status={normalizePointStatus(selectedPoint.status)} />
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[color:var(--text-muted)]">最近上报时间</dt>
                <dd className="text-right text-[color:var(--text-primary)]">{selectedPoint.lastReportAt}</dd>
              </div>
            </dl>
          </div>
        ) : null}

        {hoveredPoint ? (
          <div
            className="sf-glass-strong pointer-events-none absolute z-30 hidden w-[280px] rounded-[16px] p-4 text-left sm:block"
            style={{ left: hoveredPoint.x, top: hoveredPoint.y }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">{hoveredPoint.point.deviceName}</p>
                <p className="mt-1 truncate text-xs text-[color:var(--text-muted)]">{hoveredPoint.point.deviceType}</p>
              </div>
              <StatusBadge status={normalizePointStatus(hoveredPoint.point.status)} />
            </div>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-[color:var(--text-muted)]">所在位置</dt>
                <dd className="max-w-[150px] text-right text-[color:var(--text-primary)]">{hoveredPoint.point.positionLabel}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[color:var(--text-muted)]">最近上报时间</dt>
                <dd className="text-right text-[color:var(--text-primary)]">{hoveredPoint.point.lastReportAt}</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PublishedDrawingSceneSelector({
  scenes,
  activeScene,
  onSelect,
}: {
  scenes: PublishedDrawingScene[];
  activeScene: PublishedDrawingScene;
  onSelect: (drawingId: string) => void;
}) {
  const areaOptions = useMemo(() => {
    const seen = new Set<string>();
    return scenes
      .filter((scene) => {
        if (seen.has(scene.areaId)) return false;
        seen.add(scene.areaId);
        return true;
      })
      .map((scene) => ({
        id: scene.areaId,
        label: scene.areaLabel,
      }));
  }, [scenes]);

  const activeAreaScenes = useMemo(
    () => scenes.filter((scene) => scene.areaId === activeScene.areaId),
    [activeScene.areaId, scenes],
  );
  const activeAreaHasFloors = activeAreaScenes.some((scene) => Boolean(scene.floorId));
  const floorOptions = useMemo(() => {
    const seen = new Set<string>();
    return activeAreaScenes
      .filter((scene) => Boolean(scene.floorId))
      .filter((scene) => {
        if (seen.has(scene.floorId)) return false;
        seen.add(scene.floorId);
        return true;
      })
      .map((scene) => ({
        id: scene.floorId,
        label: scene.floorLabel.replace(`${scene.areaLabel} / `, "") || scene.floorLabel,
      }));
  }, [activeAreaScenes]);

  const activeTargetKey = `${activeScene.areaId}:${activeScene.floorId}`;
  const drawingsForTarget = activeAreaHasFloors
    ? scenes.filter((scene) => `${scene.areaId}:${scene.floorId}` === activeTargetKey)
    : scenes.filter((scene) => scene.areaId === activeScene.areaId && !scene.floorId);

  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-1.5">
      <select
        value={activeScene.areaId}
        onChange={(event) => {
          const nextScene = scenes.find((scene) => scene.areaId === event.target.value);
          if (nextScene) onSelect(nextScene.drawing.id);
        }}
        className="sf-input h-7 w-[128px] shrink-0 px-2 text-xs sm:w-[148px]"
        aria-label="选择区域"
      >
        {areaOptions.map((target) => (
          <option key={target.id} value={target.id}>
            {target.label}
          </option>
        ))}
      </select>
      {activeAreaHasFloors ? (
        <select
          value={activeScene.floorId}
          onChange={(event) => {
            const nextScene = scenes.find(
              (scene) => scene.areaId === activeScene.areaId && scene.floorId === event.target.value,
            );
            if (nextScene) onSelect(nextScene.drawing.id);
          }}
          className="sf-input h-7 w-[96px] shrink-0 px-2 text-xs sm:w-[116px]"
          aria-label="选择楼层"
        >
          {floorOptions.map((target) => (
            <option key={target.id} value={target.id}>
              {target.label}
            </option>
          ))}
        </select>
      ) : null}
      {drawingsForTarget.length > 1 ? (
        <select
          value={activeScene.drawing.id}
          onChange={(event) => onSelect(event.target.value)}
          className="sf-input h-7 w-[136px] shrink-0 px-2 text-xs sm:w-[172px]"
          aria-label="选择图纸"
        >
          {drawingsForTarget.map((scene) => (
            <option key={scene.drawing.id} value={scene.drawing.id}>
              {scene.drawing.name}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

function FallbackInteractiveMapPanel({ zones }: { zones: FloorZone[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.62);
  const [offset, setOffset] = useState({ x: -210, y: -140 });
  const [dragState, setDragState] = useState<{
    startClientX: number;
    startClientY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<HoveredPoint | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<AlarmPoint | null>(null);
  const [activeZoneId, setActiveZoneId] = useState<string>("all");
  const [activeStatuses, setActiveStatuses] = useState<AlarmPointStatus[]>(["正常", "报警", "故障", "离线"]);

  const cadModel = useMemo(() => buildCadModel(zones), [zones]);

  const visibleZones = useMemo(() => {
    const nextZones = activeZoneId === "all" ? zones : zones.filter((zone) => zone.id === activeZoneId);
    return nextZones.map((zone) => ({
      ...zone,
      points: zone.points.filter((point) => activeStatuses.includes(normalizePointStatus(point.status))),
    }));
  }, [activeStatuses, activeZoneId, zones]);

  const projectedPoints = useMemo<ProjectedPoint[]>(() => {
    const liftX = 18 * scale;
    const liftY = -42 * scale;

    return visibleZones.flatMap((zone) =>
      zone.points.map((point) => {
        const worldPosition = getWorldPointPosition(zone.id, point);
        const groundX = offset.x + worldPosition.x * scale;
        const groundY = offset.y + worldPosition.y * scale;
        return {
          point,
          zoneId: zone.id,
          groundX,
          groundY,
          markerX: groundX + liftX,
          markerY: groundY + liftY,
          status: normalizePointStatus(point.status),
        };
      }),
    );
  }, [offset.x, offset.y, scale, visibleZones]);

  const totalVisiblePoints = projectedPoints.length;
  const denseMode = totalVisiblePoints > 500;
  const canvasMode = totalVisiblePoints > 1000;
  const selectedPointId = selectedPoint?.id ?? "";
  const interactivePoints = canvasMode
    ? projectedPoints.filter(
        (item) =>
          item.status === "报警" ||
          item.status === "故障" ||
          item.point.id === selectedPointId ||
          item.point.id === hoveredPoint?.point.id,
      )
    : projectedPoints;

  function resetViewport() {
    setScale(0.62);
    setOffset({ x: -210, y: -140 });
  }

  function toggleStatus(status: AlarmPointStatus) {
    setActiveStatuses((current) => {
      const next = current.includes(status) ? current.filter((item) => item !== status) : [...current, status];
      return next.length > 0 ? next : ["正常", "报警", "故障", "离线"];
    });
  }

  function updateHoverCard(point: AlarmPoint, clientX: number, clientY: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    setHoveredPoint({
      point,
      x: clamp(clientX - rect.left + 16, 16, rect.width - 300),
      y: clamp(clientY - rect.top - 12, 16, rect.height - 170),
    });
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    setHoveredPoint(null);
    setDragState({
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: offset.x,
      startOffsetY: offset.y,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragState) {
      return;
    }

    event.preventDefault();
    setOffset({
      x: dragState.startOffsetX + (event.clientX - dragState.startClientX),
      y: dragState.startOffsetY + (event.clientY - dragState.startClientY),
    });
  }

  function stopDragging() {
    setDragState(null);
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const worldX = (pointerX - offset.x) / scale;
    const worldY = (pointerY - offset.y) / scale;
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    const nextScale = clamp(Number((scale * factor).toFixed(2)), MIN_SCALE, MAX_SCALE);

    setScale(nextScale);
    setOffset({
      x: pointerX - worldX * nextScale,
      y: pointerY - worldY * nextScale,
    });
  }

  function handleZoomOut(event: React.PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setScale((current) => clamp(Number((current - 0.1).toFixed(2)), MIN_SCALE, MAX_SCALE));
  }

  function handleZoomReset(event: React.PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    resetViewport();
  }

  function handleZoomIn(event: React.PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setScale((current) => clamp(Number((current + 0.1).toFixed(2)), MIN_SCALE, MAX_SCALE));
  }

  return (
    <section className="sf-cad-screen relative h-full min-h-[420px] overflow-hidden rounded-[26px] lg:min-h-0">
      <div className="sf-glass absolute left-3 right-3 top-3 z-30 flex min-h-0 flex-col gap-2 rounded-[18px] px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex flex-wrap gap-1.5 text-xs">
            {statusFilters.map((filter) => (
              <button
                key={filter.status}
                type="button"
                onClick={() => toggleStatus(filter.status)}
                className={cn(
                  "sf-button px-2.5 py-1 text-xs",
                  activeStatuses.includes(filter.status)
                    ? "border-[color:var(--border-soft)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                    : "border-[color:var(--border)] bg-[var(--panel-cell-bg)] text-[color:var(--text-secondary)] hover:bg-[var(--surface-muted)]",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="hidden h-4 w-px bg-[color:var(--border)] sm:block" />
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActiveZoneId("all")}
              className={cn(
                "sf-button px-2.5 py-1 text-xs",
                activeZoneId === "all"
                  ? "border-[color:var(--border-soft)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                  : "border-[color:var(--border)] bg-[var(--panel-cell-bg)] text-[color:var(--text-secondary)] hover:bg-[var(--surface-muted)]",
              )}
            >
              全部区域
            </button>
            {zones.map((zone) => (
              <button
                key={zone.id}
                type="button"
                onClick={() => setActiveZoneId(zone.id)}
                className={cn(
                  "sf-button px-2.5 py-1 text-xs",
                  activeZoneId === zone.id
                    ? "border-[color:var(--border-soft)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                    : "border-[color:var(--border)] bg-[var(--panel-cell-bg)] text-[color:var(--text-secondary)] hover:bg-[var(--surface-muted)]",
                )}
              >
                {zone.name}
              </button>
            ))}
          </div>
        </div>
        <div className="hidden shrink-0 gap-2 text-[11px] text-[color:var(--text-muted)] 2xl:flex">
          <span>底图: {cadModel.name}</span>
          <span>点位: {totalVisiblePoints}</span>
          {canvasMode ? <span>高密度模式</span> : null}
        </div>
      </div>

      <div
        ref={containerRef}
        className={cn("relative h-full min-h-0 overflow-hidden select-none touch-none", dragState ? "cursor-grabbing" : "cursor-grab")}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onPointerLeave={stopDragging}
        onContextMenu={(event) => event.preventDefault()}
        onWheel={handleWheel}
      >
        <div className="absolute inset-0 bg-[image:var(--cad-overlay-grid)] bg-[size:46px_46px]" />

        <div className="absolute bottom-3 right-3 z-30 flex items-center gap-2 sm:bottom-4 sm:right-4">
          <button type="button" aria-label="缩小" onPointerDown={handleZoomOut} className="sf-button sf-button-secondary bg-[var(--panel-cell-bg)] px-2.5 py-2 text-[11px] backdrop-blur sm:px-3 sm:text-xs">
            -
          </button>
          <button type="button" aria-label="复位" onPointerDown={handleZoomReset} className="sf-button sf-button-secondary bg-[var(--panel-cell-bg)] px-2.5 py-2 text-[11px] backdrop-blur sm:px-3 sm:text-xs">
            复位
          </button>
          <button type="button" aria-label="放大" onPointerDown={handleZoomIn} className="sf-button sf-button-secondary bg-[var(--panel-cell-bg)] px-2.5 py-2 text-[11px] backdrop-blur sm:px-3 sm:text-xs">
            +
          </button>
        </div>

        <div
          className="sf-cad-lite-plane absolute left-0 top-0 origin-top-left select-none"
          style={{
            width: WORLD_WIDTH,
            height: WORLD_HEIGHT,
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          }}
        >
          <CadSvg cadModel={cadModel} />

          {visibleZones.map((zone) => {
            const frame = zoneLayout[zone.id] ?? zoneLayout["zone-1"];
            return (
              <section
                key={zone.id}
                className="absolute rounded-[18px] border border-[color:var(--border-strong)] bg-[var(--cad-zone-bg)] p-4 shadow-[var(--panel-shadow)]"
                style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className={`rounded-full border border-[color:var(--border)] bg-[var(--cad-zone-label-bg)] px-3 py-1 text-[11px] font-semibold ${frame.labelTone}`}>
                    {zone.level}
                  </div>
                  <div className="rounded-full border border-[color:var(--border)] bg-[var(--cad-risk-bg)] px-3 py-1 text-[11px] text-[color:var(--text-muted)]">
                    {zone.riskLevel}
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" aria-hidden="true">
          {projectedPoints.map((item) => (
            <g key={`${item.point.id}-guide`}>
              <line
                x1={item.groundX}
                y1={item.groundY}
                x2={item.markerX}
                y2={item.markerY}
                className="sf-device-guide-line"
              />
              <circle cx={item.groundX} cy={item.groundY} r={denseMode ? 2.2 : 3.2} className="sf-device-ground-anchor" />
            </g>
          ))}
          {canvasMode
            ? projectedPoints
                .filter((item) => item.status === "正常" || item.status === "离线")
                .map((item) => (
                  <circle
                    key={`${item.point.id}-dense`}
                    cx={item.markerX}
                    cy={item.markerY}
                    r={item.status === "离线" ? 3 : 3.5}
                    className={item.status === "离线" ? "sf-dense-point-offline" : "sf-dense-point-normal"}
                  />
                ))
            : null}
        </svg>

        <div className="pointer-events-none absolute inset-0 z-20">
          {interactivePoints.map((item) => (
            <button
              key={item.point.id}
              type="button"
              draggable={false}
              aria-label={item.point.deviceName}
              className={cn(
                "sf-floating-marker pointer-events-auto",
                markerTone[item.status] ?? markerTone["正常"],
                denseMode && item.status !== "报警" ? "sf-floating-marker-static" : "",
                selectedPoint?.id === item.point.id ? "sf-floating-marker-selected" : "",
              )}
              style={{ left: item.markerX, top: item.markerY }}
              onDragStart={(event) => event.preventDefault()}
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
              onMouseEnter={(event) => updateHoverCard(item.point, event.clientX, event.clientY)}
              onMouseMove={(event) => updateHoverCard(item.point, event.clientX, event.clientY)}
              onMouseLeave={() => setHoveredPoint(null)}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedPoint(item.point);
              }}
            />
          ))}
        </div>

        {selectedPoint ? (
          <div className="sf-glass-strong absolute bottom-3 left-3 right-3 z-30 rounded-[16px] p-4 sm:left-4 sm:right-auto sm:w-[320px]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">{selectedPoint.deviceName}</p>
                <p className="mt-1 truncate text-xs text-[color:var(--text-muted)]">{selectedPoint.deviceType}</p>
              </div>
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onPointerUp={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedPoint(null);
                }}
                className="sf-button sf-button-secondary px-2.5 py-1 text-[11px]"
              >
                关闭
              </button>
            </div>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-[color:var(--text-muted)]">所在位置</dt>
                <dd className="max-w-[170px] text-right text-[color:var(--text-primary)]">{selectedPoint.positionLabel}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[color:var(--text-muted)]">当前状态</dt>
                <dd className="text-right">
                  <StatusBadge status={normalizePointStatus(selectedPoint.status)} />
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[color:var(--text-muted)]">最近上报时间</dt>
                <dd className="text-right text-[color:var(--text-primary)]">{selectedPoint.lastReportAt}</dd>
              </div>
            </dl>
          </div>
        ) : null}

        {hoveredPoint ? (
          <div
            className="sf-glass-strong pointer-events-none absolute z-30 hidden w-[280px] rounded-[16px] p-4 text-left sm:block"
            style={{ left: hoveredPoint.x, top: hoveredPoint.y }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">{hoveredPoint.point.deviceName}</p>
                <p className="mt-1 truncate text-xs text-[color:var(--text-muted)]">{hoveredPoint.point.deviceType}</p>
              </div>
              <StatusBadge status={normalizePointStatus(hoveredPoint.point.status)} />
            </div>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-[color:var(--text-muted)]">所在位置</dt>
                <dd className="max-w-[150px] text-right text-[color:var(--text-primary)]">{hoveredPoint.point.positionLabel}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[color:var(--text-muted)]">最近上报时间</dt>
                <dd className="text-right text-[color:var(--text-primary)]">{hoveredPoint.point.lastReportAt}</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function InteractiveMapPanel({
  zones,
  drawingScenes,
}: {
  zones: FloorZone[];
  drawingScenes?: PublishedDrawingScene[];
}) {
  const [selectedDrawingId, setSelectedDrawingId] = useState("");
  const activeScene =
    drawingScenes?.find((scene) => scene.drawing.id === selectedDrawingId) ?? drawingScenes?.[0] ?? null;

  if (!activeScene || !drawingScenes?.length) {
    return <FallbackInteractiveMapPanel zones={zones} />;
  }

  return (
    <div className="relative h-full min-h-0">
      <PublishedDrawingMapPanel scenes={drawingScenes} scene={activeScene} onSelectScene={setSelectedDrawingId} />
    </div>
  );
}
