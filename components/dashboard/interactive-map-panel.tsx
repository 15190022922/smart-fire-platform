"use client";

import { useMemo, useRef, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/cn";
import type { AlarmPoint, FloorZone } from "@/types/platform";

const WORLD_WIDTH = 2200;
const WORLD_HEIGHT = 1320;
const MIN_SCALE = 0.5;
const MAX_SCALE = 2;

const zoneLayout: Record<
  string,
  { x: number; y: number; width: number; height: number; tone: string; labelTone: string }
> = {
  "zone-1": { x: 220, y: 210, width: 620, height: 360, tone: "bg-[var(--cad-zone-bg)]", labelTone: "text-[var(--accent-strong)]" },
  "zone-2": { x: 1280, y: 170, width: 560, height: 380, tone: "bg-[var(--cad-zone-bg)]", labelTone: "text-[var(--info)]" },
  "zone-3": { x: 320, y: 860, width: 760, height: 290, tone: "bg-[var(--cad-zone-bg)]", labelTone: "text-[color:var(--text-secondary)]" },
  "zone-4": { x: 1420, y: 860, width: 420, height: 260, tone: "bg-[var(--cad-zone-bg)]", labelTone: "text-[var(--success-strong)]" },
};

const pointTone: Record<string, string> = {
  正常: "border-[rgba(57,118,91,0.38)] bg-[var(--success)]",
  报警: "border-[rgba(176,72,79,0.42)] bg-[var(--danger)] point-pulse",
  故障: "border-[rgba(169,107,34,0.42)] bg-[var(--warning)]",
  离线: "border-[rgba(107,125,145,0.35)] bg-[rgb(130,144,160)]",
};

type HoveredPoint = {
  point: AlarmPoint;
  x: number;
  y: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getWorldPointPosition(zoneId: string, point: AlarmPoint) {
  const frame = zoneLayout[zoneId];
  return {
    x: frame.x + (point.x / 100) * frame.width,
    y: frame.y + (point.y / 100) * frame.height,
  };
}

export function InteractiveMapPanel({ zones }: { zones: FloorZone[] }) {
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

  const visibleZones = useMemo(() => {
    if (activeZoneId === "all") {
      return zones;
    }
    return zones.filter((zone) => zone.id === activeZoneId);
  }, [activeZoneId, zones]);

  function resetViewport() {
    setScale(0.62);
    setOffset({ x: -210, y: -140 });
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
      <div className="sf-glass absolute left-3 right-3 top-3 z-30 flex min-h-0 flex-col gap-2 rounded-full px-3 py-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex flex-wrap gap-1.5 text-xs">
            <span className="rounded-full border border-[rgba(57,118,91,0.16)] bg-[var(--success-soft)] px-2.5 py-1 text-[var(--success-strong)]">正常</span>
            <span className="rounded-full border border-[rgba(176,72,79,0.18)] bg-[var(--danger-soft)] px-2.5 py-1 text-[var(--danger-strong)]">报警</span>
            <span className="rounded-full border border-[rgba(169,107,34,0.18)] bg-[var(--warning-soft)] px-2.5 py-1 text-[var(--warning-strong)]">故障</span>
            <span className="rounded-full border border-[rgba(107,125,145,0.18)] bg-[var(--neutral-soft)] px-2.5 py-1 text-[color:var(--text-secondary)]">离线</span>
          </div>
          <div className="hidden h-4 w-px bg-[color:var(--border)] sm:block" />
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActiveZoneId("all")}
              className={cn(
                "sf-button rounded-full px-2.5 py-1 text-xs",
                activeZoneId === "all"
                  ? "border-[rgba(72,106,141,0.18)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
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
                  "sf-button rounded-full px-2.5 py-1 text-xs",
                  activeZoneId === zone.id
                    ? "border-[rgba(72,106,141,0.18)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                    : "border-[color:var(--border)] bg-[var(--panel-cell-bg)] text-[color:var(--text-secondary)] hover:bg-[var(--surface-muted)]",
                )}
              >
                {zone.name}
              </button>
            ))}
          </div>
        </div>
        {selectedPoint ? (
          <span className="hidden shrink-0 rounded-full border border-[rgba(72,106,141,0.18)] bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--accent-strong)] xl:inline-flex">
            {selectedPoint.deviceName}
          </span>
        ) : null}
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

        <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2 sm:bottom-4 sm:right-4">
          <button
            type="button"
            aria-label="缩小"
            onPointerDown={handleZoomOut}
            className="sf-button sf-button-secondary bg-[var(--panel-cell-bg)] px-2.5 py-2 text-[11px] backdrop-blur sm:px-3 sm:text-xs"
          >
            -
          </button>
          <button
            type="button"
            aria-label="复位"
            onPointerDown={handleZoomReset}
            className="sf-button sf-button-secondary bg-[var(--panel-cell-bg)] px-2.5 py-2 text-[11px] backdrop-blur sm:px-3 sm:text-xs"
          >
            复位
          </button>
          <button
            type="button"
            aria-label="放大"
            onPointerDown={handleZoomIn}
            className="sf-button sf-button-secondary bg-[var(--panel-cell-bg)] px-2.5 py-2 text-[11px] backdrop-blur sm:px-3 sm:text-xs"
          >
            +
          </button>
        </div>

        <div
          className="absolute left-0 top-0 origin-top-left select-none"
          style={{
            width: WORLD_WIDTH,
            height: WORLD_HEIGHT,
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          }}
        >
          <div className="absolute left-[120px] top-[590px] h-[92px] w-[1900px] rounded-full bg-[var(--cad-road-bg)]" />
          <div className="absolute left-[1020px] top-[90px] h-[1040px] w-[108px] rounded-full bg-[var(--cad-road-bg)]" />
          <div className="absolute left-[140px] top-[120px] h-[180px] w-[250px] rounded-[30px] border border-[color:var(--cad-shape-border)] bg-[var(--cad-block-bg)]" />
          <div className="absolute right-[160px] top-[120px] h-[220px] w-[260px] rounded-[32px] border border-[color:var(--cad-shape-border)] bg-[var(--cad-block-alt-bg)]" />
          <div className="absolute right-[220px] bottom-[100px] h-[200px] w-[250px] rounded-[32px] border border-[color:var(--cad-line)] bg-[var(--cad-block-safe-bg)]" />
          <div className="absolute left-[500px] top-[120px] h-[120px] w-[240px] rounded-[22px] border border-dashed border-[color:var(--cad-shape-border)] bg-[var(--cad-dash-bg)]" />
          <div className="absolute left-[1440px] top-[690px] h-[130px] w-[190px] rounded-[22px] border border-dashed border-[color:var(--cad-shape-border)] bg-[var(--cad-dash-bg)]" />

          {visibleZones.map((zone) => {
            const frame = zoneLayout[zone.id];

            return (
              <section
                key={zone.id}
                className="absolute rounded-[20px] border border-[color:var(--border-strong)] bg-[var(--cad-zone-bg)] p-4 shadow-[var(--panel-shadow)] backdrop-blur-[2px]"
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
                <div className={`relative mt-3 h-[calc(100%-44px)] rounded-[16px] border border-[color:var(--cad-shape-border)] ${frame.tone}`}>
                  <div className="absolute inset-4 rounded-[12px] border border-dashed border-[color:var(--cad-line)]" />
                  <div className="absolute left-[22%] top-0 h-full w-px bg-[var(--cad-line)]" />
                  <div className="absolute left-[61%] top-0 h-full w-px bg-[var(--cad-line)]" />
                  <div className="absolute top-[30%] h-px w-full bg-[var(--cad-line)]" />
                  <div className="absolute top-[68%] h-px w-full bg-[var(--cad-line)]" />
                </div>
              </section>
            );
          })}

          {visibleZones.flatMap((zone) =>
            zone.points.map((point) => {
              const position = getWorldPointPosition(zone.id, point);
              return (
                <button
                  key={point.id}
                  type="button"
                  draggable={false}
                  aria-label={point.deviceName}
                  className={`absolute h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border-2 shadow-[0_0_0_3px_rgba(96,145,204,0.32)] ${pointTone[point.status] ?? pointTone["正常"]}`}
                  style={{ left: position.x, top: position.y }}
                  onDragStart={(event) => event.preventDefault()}
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                  onMouseEnter={(event) => updateHoverCard(point, event.clientX, event.clientY)}
                  onMouseMove={(event) => updateHoverCard(point, event.clientX, event.clientY)}
                  onMouseLeave={() => setHoveredPoint(null)}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedPoint(point);
                  }}
                />
              );
            }),
          )}
        </div>

        {selectedPoint ? (
          <div className="sf-glass-strong absolute bottom-3 left-3 right-3 z-20 rounded-[16px] p-4 sm:left-4 sm:right-auto sm:w-[320px]">
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
                  <StatusBadge status={selectedPoint.status} />
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
            className="sf-glass-strong pointer-events-none absolute z-20 hidden w-[280px] rounded-[16px] p-4 text-left sm:block"
            style={{ left: hoveredPoint.x, top: hoveredPoint.y }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">{hoveredPoint.point.deviceName}</p>
                <p className="mt-1 truncate text-xs text-[color:var(--text-muted)]">{hoveredPoint.point.deviceType}</p>
              </div>
              <StatusBadge status={hoveredPoint.point.status} />
            </div>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-[color:var(--text-muted)]">所在位置</dt>
                <dd className="max-w-[150px] text-right text-[color:var(--text-primary)]">{hoveredPoint.point.positionLabel}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[color:var(--text-muted)]">当前状态</dt>
                <dd className="text-right text-[color:var(--text-primary)]">{hoveredPoint.point.status}</dd>
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
