"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";
import type { TenantDrawingRecord } from "@/types/hardware";

type SurfaceSize = {
  width: number;
  height: number;
};

type PdfRenderState = {
  status: "loading" | "ready" | "failed";
  message: string;
};

type ViewportState = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

type DragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
};

const MIN_DRAWING_SCALE = 1;
const MAX_DRAWING_SCALE = 8;
const MAX_PDF_CANVAS_SIDE = 4096;
const MAX_PDF_CANVAS_PIXELS = 12000000;
const MAX_DISPLAY_SIDE = 1800;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function shouldIgnorePanTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest("button,a,input,select,textarea,[data-drawing-no-pan]"));
}

function isVisualImageUrl(url: string) {
  const normalized = url.split("?")[0]?.toLowerCase() ?? "";
  return (
    normalized.endsWith(".png") ||
    normalized.endsWith(".jpg") ||
    normalized.endsWith(".jpeg") ||
    normalized.endsWith(".webp") ||
    normalized.endsWith(".gif") ||
    normalized.endsWith(".svg")
  );
}

function normalizeDisplaySize(width: number, height: number) {
  if (width <= 0 || height <= 0) return { width: 16, height: 9 };
  const maxSide = Math.max(width, height);
  if (maxSide <= MAX_DISPLAY_SIDE) return { width, height };
  const ratio = MAX_DISPLAY_SIDE / maxSide;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

function DrawingError({
  drawing,
  message,
}: {
  drawing: TenantDrawingRecord;
  message?: string;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface-muted)] px-6 text-center">
      <div className="max-w-[420px] rounded-[16px] border border-[color:var(--border-soft)] bg-[var(--panel-cell-bg)] px-4 py-3 text-sm text-[color:var(--text-secondary)]">
        <p className="font-semibold text-[color:var(--text-primary)]">图纸暂不可视化</p>
        <p className="mt-2 leading-5">{message || drawing.processingMessage || "图纸文件无法访问，请重新上传或检查转换服务。"}</p>
        {drawing.conversionLog.length > 0 ? (
          <div className="mt-3 space-y-1 text-left text-xs text-[color:var(--text-muted)]">
            {drawing.conversionLog.slice(0, 3).map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PdfCanvasSurface({
  url,
  name,
  onPageSize,
  renderScale = 1,
  fallbackImageUrl,
}: {
  url: string;
  name: string;
  onPageSize?: (size: SurfaceSize) => void;
  renderScale?: number;
  fallbackImageUrl?: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocumentRef = useRef<PDFDocumentProxy | null>(null);
  const pdfPageRef = useRef<PDFPageProxy | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const [surfaceSize, setSurfaceSize] = useState<SurfaceSize>({ width: 0, height: 0 });
  const [pageVersion, setPageVersion] = useState(0);
  const [renderState, setRenderState] = useState<PdfRenderState>({
    status: "loading",
    message: "正在读取 PDF 图纸...",
  });

  useEffect(() => {
    const target = frameRef.current;
    if (!target) return;

    const updateSize = () => {
      const rect = target.getBoundingClientRect();
      const nextSize = {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
      setSurfaceSize((current) =>
        current.width === nextSize.width && current.height === nextSize.height ? current : nextSize,
      );
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;

    async function loadPdf() {
      setRenderState({ status: "loading", message: "正在读取 PDF 图纸..." });
      pdfPageRef.current?.cleanup?.();
      pdfPageRef.current = null;
      await pdfDocumentRef.current?.destroy().catch(() => undefined);
      pdfDocumentRef.current = null;

      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc ||= new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString();

        const response = await fetch(url, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) {
          throw new Error(`PDF 文件读取失败 (${response.status})`);
        }

        const data = new Uint8Array(await response.arrayBuffer());
        loadingTask = pdfjs.getDocument({ data });
        const pdfDocument = await loadingTask.promise;
        const firstPage = await pdfDocument.getPage(1);

        if (cancelled) {
          firstPage.cleanup?.();
          await pdfDocument.destroy();
          return;
        }

        pdfDocumentRef.current = pdfDocument;
        pdfPageRef.current = firstPage;
        const viewport = firstPage.getViewport({ scale: 1 });
        onPageSize?.({
          width: Math.max(1, Math.round(viewport.width)),
          height: Math.max(1, Math.round(viewport.height)),
        });
        setRenderState({ status: "loading", message: "正在绘制 PDF 图纸..." });
        setPageVersion((current) => current + 1);
      } catch (error) {
        if (!cancelled) {
          setRenderState({
            status: "failed",
            message: error instanceof Error ? error.message : "PDF 图纸渲染失败，请重新上传或检查文件。",
          });
        }
      }
    }

    void loadPdf();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      void loadingTask?.destroy().catch(() => undefined);
      pdfPageRef.current?.cleanup?.();
      pdfPageRef.current = null;
      void pdfDocumentRef.current?.destroy().catch(() => undefined);
      pdfDocumentRef.current = null;
    };
  }, [onPageSize, url]);

  useEffect(() => {
    const page = pdfPageRef.current;
    const canvas = canvasRef.current;
    if (!page || !canvas || surfaceSize.width <= 0 || surfaceSize.height <= 0) {
      return;
    }

    let cancelled = false;
    const context = canvas.getContext("2d");
    if (!context) {
      setRenderState({ status: "failed", message: "当前浏览器不支持 PDF 画布渲染。" });
      return;
    }

    renderTaskRef.current?.cancel();
    const baseViewport = page.getViewport({ scale: 1 });
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const desiredWidth = surfaceSize.width * pixelRatio * renderScale;
    const desiredHeight = surfaceSize.height * pixelRatio * renderScale;
    const sideScale = Math.min(MAX_PDF_CANVAS_SIDE / baseViewport.width, MAX_PDF_CANVAS_SIDE / baseViewport.height);
    const pixelScale = Math.sqrt(MAX_PDF_CANVAS_PIXELS / Math.max(baseViewport.width * baseViewport.height, 1));
    const scale = Math.max(
      Math.min(desiredWidth / baseViewport.width, desiredHeight / baseViewport.height, sideScale, pixelScale),
      0.2,
    );
    const viewport = page.getViewport({ scale });

    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    let renderTask: RenderTask;
    try {
      renderTask = page.render({ canvasContext: context, canvas, viewport });
    } catch (error) {
      window.requestAnimationFrame(() => {
        setRenderState({
          status: "failed",
          message: error instanceof Error ? error.message : "PDF 图纸渲染失败，请重新上传或检查文件。",
        });
      });
      return;
    }
    renderTaskRef.current = renderTask;
    setRenderState({ status: "loading", message: renderScale > 1.05 ? "正在绘制高清 PDF 图纸..." : "正在绘制 PDF 图纸..." });

    renderTask.promise
      .then(() => {
        if (!cancelled) {
          setRenderState({ status: "ready", message: "" });
        }
      })
      .catch((error) => {
        if (!cancelled && error?.name !== "RenderingCancelledException") {
          setRenderState({
            status: "failed",
            message: error instanceof Error ? error.message : "PDF 图纸渲染失败，请重新上传或检查文件。",
          });
        }
      });

    return () => {
      cancelled = true;
      renderTask.cancel();
    };
  }, [pageVersion, renderScale, surfaceSize.height, surfaceSize.width]);

  return (
    <div ref={frameRef} className="absolute inset-0 flex items-center justify-center bg-white">
      {fallbackImageUrl ? (
        <img
          src={fallbackImageUrl}
          alt={name}
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain"
        />
      ) : null}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full bg-white" aria-label={name} />
      {renderState.status === "loading" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 px-6 text-center text-sm text-[color:var(--text-secondary)] backdrop-blur-sm">
          {renderState.message}
        </div>
      ) : null}
      {renderState.status === "failed" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface-muted)]/90 px-6 text-center">
          <div className="max-w-[420px] rounded-[16px] border border-[color:var(--border-soft)] bg-[var(--panel-cell-bg)] px-4 py-3 text-sm text-[color:var(--text-secondary)]">
            <p className="font-semibold text-[color:var(--text-primary)]">PDF 图纸渲染失败</p>
            <p className="mt-2 leading-5">{fallbackImageUrl ? "高清 PDF 渲染失败，当前暂用预览图显示。" : renderState.message}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function DrawingSurface({
  drawing,
  children,
  onPlacePoint,
  className = "",
}: {
  drawing: TenantDrawingRecord;
  children?: React.ReactNode;
  onPlacePoint?: (point: { x: number; y: number }) => void;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [pdfPageSize, setPdfPageSize] = useState<SurfaceSize | null>(null);
  const [viewport, setViewport] = useState<ViewportState>({ scale: 1, offsetX: 0, offsetY: 0 });
  const [pdfRenderScale, setPdfRenderScale] = useState(1);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [containerSize, setContainerSize] = useState<SurfaceSize>({ width: 0, height: 0 });
  const shellRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const baseUrl = drawing.sceneUrl || drawing.previewUrl || drawing.fileUrl;
  const cacheKey = encodeURIComponent(String(drawing.updatedAt ?? drawing.publishedAt ?? drawing.id));
  const url = baseUrl ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}v=${cacheKey}` : baseUrl;
  const basePdfSourceUrl = drawing.sourceFileUrl || drawing.fileUrl || baseUrl;
  const pdfSourceUrl = basePdfSourceUrl
    ? `${basePdfSourceUrl}${basePdfSourceUrl.includes("?") ? "&" : "?"}v=${cacheKey}`
    : basePdfSourceUrl;
  const isFailedProcessing = drawing.processingStatus === "failed";
  const isRenderablePdf = drawing.fileType === "pdf";
  const hasVisualImage = isVisualImageUrl(url);
  const resolvedWidth = isRenderablePdf && !hasVisualImage && pdfPageSize ? pdfPageSize.width : drawing.width;
  const resolvedHeight = isRenderablePdf && !hasVisualImage && pdfPageSize ? pdfPageSize.height : drawing.height;
  const displaySize = normalizeDisplaySize(resolvedWidth, resolvedHeight);
  const aspectValue = displaySize.width / displaySize.height;
  const aspectRatio = `${displaySize.width} / ${displaySize.height}`;
  const fittedSize =
    containerSize.width > 0 && containerSize.height > 0
      ? (() => {
          let width = containerSize.width;
          let height = width / aspectValue;
          if (height > containerSize.height) {
            height = containerSize.height;
            width = height * aspectValue;
          }
          return { width: Math.max(1, Math.floor(width)), height: Math.max(1, Math.floor(height)) };
        })()
      : null;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setFailed(false);
      setPdfPageSize(null);
      setViewport({ scale: 1, offsetX: 0, offsetY: 0 });
      setPdfRenderScale(1);
      setDragState(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [drawing.id, url]);

  useEffect(() => {
    if (!isRenderablePdf) return;
    const timer = window.setTimeout(() => setPdfRenderScale(viewport.scale), 180);
    return () => window.clearTimeout(timer);
  }, [isRenderablePdf, viewport.scale]);

  useEffect(() => {
    const target = shellRef.current;
    if (!target) return;
    const updateSize = () => {
      const rect = target.getBoundingClientRect();
      const nextSize = { width: Math.round(rect.width), height: Math.round(rect.height) };
      setContainerSize((current) =>
        current.width === nextSize.width && current.height === nextSize.height ? current : nextSize,
      );
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  function placePointAt(clientX: number, clientY: number) {
    if (!onPlacePoint) return;
    const rect = planeRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    onPlacePoint({
      x: Number(clamp((clientX - rect.left) / rect.width, 0, 1).toFixed(4)),
      y: Number(clamp((clientY - rect.top) / rect.height, 0, 1).toFixed(4)),
    });
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || shouldIgnorePanTarget(event.target)) return;
    event.preventDefault();
    setDragState({
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: viewport.offsetX,
      startOffsetY: viewport.offsetY,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    event.preventDefault();
    const deltaX = event.clientX - dragState.startClientX;
    const deltaY = event.clientY - dragState.startClientY;
    if (Math.hypot(deltaX, deltaY) < 2) return;
    setViewport((current) => ({
      ...current,
      offsetX: dragState.startOffsetX + deltaX,
      offsetY: dragState.startOffsetY + deltaY,
    }));
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    event.preventDefault();
    const deltaX = event.clientX - dragState.startClientX;
    const deltaY = event.clientY - dragState.startClientY;
    const distance = Math.hypot(deltaX, deltaY);
    setDragState(null);
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (distance <= 4) {
      placePointAt(event.clientX, event.clientY);
    }
  }

  function handlePointerCancel(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    setDragState(null);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function zoomAt(clientX: number, clientY: number, deltaY: number) {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return;

    const pointerX = clamp(clientX, rect.left, rect.right) - rect.left;
    const pointerY = clamp(clientY, rect.top, rect.bottom) - rect.top;
    setViewport((current) => {
      const factor = deltaY > 0 ? 0.88 : 1.12;
      const nextScale = clamp(Number((current.scale * factor).toFixed(3)), MIN_DRAWING_SCALE, MAX_DRAWING_SCALE);
      if (nextScale === current.scale) return current;
      if (nextScale === MIN_DRAWING_SCALE) {
        return { scale: nextScale, offsetX: 0, offsetY: 0 };
      }
      const worldX = (pointerX - current.offsetX) / current.scale;
      const worldY = (pointerY - current.offsetY) / current.scale;
      return {
        scale: nextScale,
        offsetX: pointerX - worldX * nextScale,
        offsetY: pointerY - worldY * nextScale,
      };
    });
  }

  useEffect(() => {
    const target = shellRef.current;
    if (!target) return;

    const handleNativeWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      zoomAt(event.clientX, event.clientY, event.deltaY);
    };

    target.addEventListener("wheel", handleNativeWheel, { passive: false, capture: true });
    return () => target.removeEventListener("wheel", handleNativeWheel, { capture: true });
  }, []);

  function resetViewport() {
    setViewport({ scale: 1, offsetX: 0, offsetY: 0 });
    setDragState(null);
  }

  return (
    <div
      ref={shellRef}
      className={`relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden ${className}`}
      style={{ overscrollBehavior: "contain" }}
    >
      <div
        ref={surfaceRef}
        className="relative overflow-hidden rounded-[18px] bg-white shadow-[var(--panel-shadow)]"
        style={
          fittedSize
            ? { width: `${fittedSize.width}px`, height: `${fittedSize.height}px`, overscrollBehavior: "contain" }
            : { width: "100%", aspectRatio, overscrollBehavior: "contain" }
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onDoubleClick={resetViewport}
      >
        <div
          ref={planeRef}
          className="absolute inset-0 origin-top-left touch-none select-none"
          style={{
            transform: `translate(${viewport.offsetX}px, ${viewport.offsetY}px) scale(${viewport.scale})`,
            cursor: dragState ? "grabbing" : onPlacePoint ? "crosshair" : "grab",
          }}
        >
          {isFailedProcessing || failed ? (
            <DrawingError drawing={drawing} />
          ) : isRenderablePdf ? (
            <PdfCanvasSurface
              url={pdfSourceUrl}
              name={drawing.name}
              onPageSize={setPdfPageSize}
              renderScale={pdfRenderScale}
              fallbackImageUrl={hasVisualImage ? url : undefined}
            />
          ) : hasVisualImage ? (
            <img
              src={url}
              alt={drawing.name}
              draggable={false}
              className="absolute inset-0 h-full w-full object-contain"
              onError={() => setFailed(true)}
            />
          ) : (
            <DrawingError drawing={drawing} message="图纸文件暂时无法直接显示，请重新上传 PDF 或图片文件。" />
          )}

          <div className="pointer-events-none absolute inset-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
