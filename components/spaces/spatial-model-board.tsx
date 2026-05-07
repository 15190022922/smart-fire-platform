"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DrawingSurface } from "@/components/drawings/drawing-surface";
import { SectionCard } from "@/components/section-card";
import { AlertMessage } from "@/components/ui/alert-message";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { getTenantEventBus } from "@/lib/realtime/event-bus";
import type { TenantBuildingRecord, TenantDrawingRecord, TenantFloorRecord, TenantSpatialModel } from "@/types/hardware";

type WorkView = "structure" | "drawings" | "publish";
type AreaDialogMode = "create" | "edit" | null;

type UploadFormState = {
  name: string;
  version: string;
  fileName: string;
  fileUrl: string;
  sourceFileUrl: string;
  previewUrl: string;
  sceneUrl: string;
  fileType: "image" | "pdf";
  fileSize: number;
  processingStatus: "processing" | "ready" | "failed";
  processingMessage: string;
  conversionLog: string[];
  width: number;
  height: number;
};

type AreaFormState = {
  id: string;
  name: string;
  code: string;
  areaType: string;
  hasFloors: boolean;
  sortOrder: number;
  status: "active" | "inactive";
  description: string;
};

type FloorFormState = {
  id: string;
  name: string;
  code: string;
  levelIndex: number;
  sortOrder: number;
  status: "active" | "inactive";
  description: string;
};

const inputClassName = "sf-input h-10 px-3 text-sm";
const smallButtonClass = "sf-button sf-button-secondary h-8 px-3 text-xs";

const views: Array<{ id: WorkView; label: string; description: string }> = [
  { id: "structure", label: "区域结构", description: "维护区域基础信息和楼层配置" },
  { id: "drawings", label: "图纸绑定", description: "给当前区域或楼层绑定图纸草稿" },
  { id: "publish", label: "发布检查", description: "确认图纸是否能进入可视化大屏" },
];

function emptyUploadForm(): UploadFormState {
  return {
    name: "",
    version: "v1.0",
    fileName: "",
    fileUrl: "",
    sourceFileUrl: "",
    previewUrl: "",
    sceneUrl: "",
    fileType: "image",
    fileSize: 0,
    processingStatus: "ready",
    processingMessage: "",
    conversionLog: [],
    width: 1600,
    height: 900,
  };
}

function emptyAreaForm(sortOrder = 1): AreaFormState {
  return {
    id: "",
    name: "",
    code: "",
    areaType: "factory",
    hasFloors: true,
    sortOrder,
    status: "active",
    description: "",
  };
}

function emptyFloorForm(sortOrder = 1): FloorFormState {
  return {
    id: "",
    name: `${sortOrder}层`,
    code: "",
    levelIndex: sortOrder,
    sortOrder,
    status: "active",
    description: "",
  };
}

function areaToForm(area: TenantBuildingRecord): AreaFormState {
  return {
    id: area.id,
    name: area.name,
    code: area.code,
    areaType: area.areaType || area.usageType || "factory",
    hasFloors: area.hasFloors,
    sortOrder: area.sortOrder,
    status: area.status,
    description: area.description,
  };
}

function floorToForm(floor: TenantFloorRecord): FloorFormState {
  return {
    id: floor.id,
    name: floor.name,
    code: floor.code,
    levelIndex: floor.levelIndex,
    sortOrder: floor.sortOrder,
    status: floor.status,
    description: floor.description,
  };
}

function sortAreas(areas: TenantBuildingRecord[]) {
  return [...areas].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "zh-CN"));
}

function sortFloors(floors: TenantFloorRecord[]) {
  return [...floors].sort((a, b) => a.sortOrder - b.sortOrder || a.levelIndex - b.levelIndex || a.name.localeCompare(b.name, "zh-CN"));
}

function sortDrawings(drawings: TenantDrawingRecord[]) {
  return [...drawings].sort((a, b) => String(b.publishedAt ?? b.updatedAt).localeCompare(String(a.publishedAt ?? a.updatedAt)));
}

function latestDrawing(drawings: TenantDrawingRecord[]) {
  return sortDrawings(drawings)[0] ?? null;
}

function drawingStatusLabel(status: string) {
  if (status === "published") return "已发布";
  if (status === "archived") return "已归档";
  return "草稿";
}

function processingStatusLabel(status: string) {
  if (status === "ready") return "可显示";
  if (status === "processing") return "处理中";
  return "转换失败";
}

function areaTypeLabel(value: string) {
  if (value === "factory") return "厂房";
  if (value === "warehouse") return "仓库";
  if (value === "pump") return "泵房";
  if (value === "office") return "办公楼";
  if (value === "outdoor") return "室外区域";
  return value || "区域";
}

function toneClass(value: string) {
  if (value === "failed") return "bg-[var(--danger-soft)] text-[color:var(--danger-strong)] border-[color:var(--border-soft)]";
  if (value === "processing" || value === "draft") return "bg-[var(--warning-soft)] text-[color:var(--warning-strong)] border-[color:var(--border-soft)]";
  if (value === "published" || value === "ready" || value === "active") return "bg-[var(--success-soft)] text-[color:var(--success-strong)] border-[color:var(--border-soft)]";
  return "bg-[var(--neutral-soft)] text-[color:var(--text-secondary)] border-[color:var(--border)]";
}

function formatFileSize(size: number) {
  if (!size) return "未知大小";
  if (size < 1024 * 1024) return `${Math.max(size / 1024, 1).toFixed(0)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function getDrawingAreaId(drawing: TenantDrawingRecord, floors: TenantFloorRecord[]) {
  return drawing.buildingId || floors.find((floor) => floor.id === drawing.floorId)?.buildingId || "";
}

function targetLabel(area: TenantBuildingRecord | null, floor: TenantFloorRecord | null) {
  if (!area) return "未选择区域";
  if (!area.hasFloors) return `${area.name} / 区域平面`;
  return floor ? `${area.name} / ${floor.name}` : `${area.name} / 未选择楼层`;
}

function drawingTargetLabel(drawing: TenantDrawingRecord, areas: TenantBuildingRecord[], floors: TenantFloorRecord[]) {
  const floor = floors.find((item) => item.id === drawing.floorId);
  const area = areas.find((item) => item.id === (drawing.buildingId || floor?.buildingId));
  return floor ? `${area?.name ?? "区域"} / ${floor.name}` : `${area?.name ?? "区域"} / 区域平面`;
}

function drawingCountsForTarget(drawings: TenantDrawingRecord[]) {
  return {
    total: drawings.length,
    published: drawings.filter((drawing) => drawing.status === "published").length,
    draft: drawings.filter((drawing) => drawing.status === "draft").length,
  };
}

function uploadDrawingFile(
  file: File,
  options?: {
    onUploadProgress?: (progress: number) => void;
    onServerProcessing?: () => void;
  },
) {
  const formData = new FormData();
  formData.append("file", file);
  return new Promise<UploadFormState & { originalFileName: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/tenant/drawing-files");
    xhr.responseType = "json";

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      options?.onUploadProgress?.(Math.min(100, Math.max(1, Math.round((event.loaded / event.total) * 100))));
    };
    xhr.upload.onload = () => {
      options?.onUploadProgress?.(100);
      options?.onServerProcessing?.();
    };
    xhr.onerror = () => reject(new Error("图纸文件上传失败，请检查网络后重试。"));
    xhr.onabort = () => reject(new Error("图纸文件上传已取消。"));
    xhr.onload = () => {
      const payload = xhr.response ?? {};
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(typeof payload.message === "string" ? payload.message : "图纸文件上传失败。"));
        return;
      }
      resolve(payload as UploadFormState & { originalFileName: string });
    };
    xhr.send(formData);
  });
}

export function SpatialModelBoard({ initialModel }: { initialModel: TenantSpatialModel }) {
  const { confirmDialog } = useConfirmDialog();
  const initialDrawing = latestDrawing(initialModel.drawings.filter((drawing) => drawing.status === "published")) ?? latestDrawing(initialModel.drawings);
  const initialAreaId = initialDrawing ? getDrawingAreaId(initialDrawing, initialModel.floors) : initialModel.buildings[0]?.id ?? "";
  const initialFloorId = initialDrawing?.floorId || initialModel.floors.find((floor) => floor.buildingId === initialAreaId)?.id || "";

  const [model, setModel] = useState(initialModel);
  const [activeView, setActiveView] = useState<WorkView>(initialModel.buildings.length ? "drawings" : "structure");
  const [selectedAreaId, setSelectedAreaId] = useState(initialAreaId);
  const [selectedFloorId, setSelectedFloorId] = useState(initialFloorId);
  const [selectedDrawingId, setSelectedDrawingId] = useState(initialDrawing?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [areaDialogMode, setAreaDialogMode] = useState<AreaDialogMode>(null);
  const [areaForm, setAreaForm] = useState<AreaFormState>(() => emptyAreaForm(initialModel.buildings.length + 1));
  const [areaFloorForms, setAreaFloorForms] = useState<FloorFormState[]>(() => [emptyFloorForm(1)]);
  const [deletedFloorIds, setDeletedFloorIds] = useState<string[]>([]);
  const [savingStructure, setSavingStructure] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState<UploadFormState>(() => emptyUploadForm());
  const [uploadAreaId, setUploadAreaId] = useState(initialAreaId);
  const [uploadFloorId, setUploadFloorId] = useState(initialFloorId);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const isRefreshingRef = useRef(false);
  const pendingRefreshRef = useRef(false);

  const areas = useMemo(() => sortAreas(model.buildings), [model.buildings]);
  const selectedArea = useMemo(() => areas.find((area) => area.id === selectedAreaId) ?? null, [areas, selectedAreaId]);
  const floorsForArea = useMemo(() => sortFloors(model.floors.filter((floor) => floor.buildingId === selectedAreaId)), [model.floors, selectedAreaId]);
  const selectedFloor = useMemo(() => floorsForArea.find((floor) => floor.id === selectedFloorId) ?? null, [floorsForArea, selectedFloorId]);
  const uploadArea = useMemo(() => areas.find((area) => area.id === uploadAreaId) ?? null, [areas, uploadAreaId]);
  const uploadFloors = useMemo(() => sortFloors(model.floors.filter((floor) => floor.buildingId === uploadAreaId)), [model.floors, uploadAreaId]);
  const uploadFloor = useMemo(() => uploadFloors.find((floor) => floor.id === uploadFloorId) ?? null, [uploadFloors, uploadFloorId]);
  const targetDrawings = useMemo(() => {
    if (!selectedArea) return [];
    return sortDrawings(
      model.drawings.filter((drawing) => {
        const drawingAreaId = getDrawingAreaId(drawing, model.floors);
        if (drawingAreaId !== selectedArea.id) return false;
        if (!selectedArea.hasFloors) return !drawing.floorId;
        return drawing.floorId === selectedFloorId;
      }),
    );
  }, [model.drawings, model.floors, selectedArea, selectedFloorId]);
  const selectedDrawing = useMemo(
    () => targetDrawings.find((drawing) => drawing.id === selectedDrawingId) ?? latestDrawing(targetDrawings),
    [selectedDrawingId, targetDrawings],
  );
  const publishedTargetDrawing = useMemo(() => latestDrawing(targetDrawings.filter((drawing) => drawing.status === "published")), [targetDrawings]);
  const totalPublishedCount = useMemo(() => model.drawings.filter((drawing) => drawing.status === "published").length, [model.drawings]);

  const refresh = useCallback(async () => {
    if (isRefreshingRef.current) {
      pendingRefreshRef.current = true;
      return;
    }
    isRefreshingRef.current = true;
    try {
      do {
        pendingRefreshRef.current = false;
        const response = await fetch("/api/tenant/spatial-model", { cache: "no-store" });
        if (response.ok) {
          setModel((await response.json()) as TenantSpatialModel);
        }
      } while (pendingRefreshRef.current);
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 30000);
    const bus = getTenantEventBus();
    const handleUpdate = () => void refresh();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const unsubscribe = bus.subscribe({
      types: ["device_status_changed", "alarm_created", "alarm_updated"],
      onEvent: handleUpdate,
    });
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(timer);
      unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refresh]);

  useEffect(() => {
    if (selectedArea?.hasFloors && !selectedFloorId && floorsForArea[0]) {
      const nextFloorId = floorsForArea[0].id;
      const frame = window.requestAnimationFrame(() => setSelectedFloorId(nextFloorId));
      return () => window.cancelAnimationFrame(frame);
    }
  }, [floorsForArea, selectedArea, selectedFloorId]);

  useEffect(() => {
    const nextDrawingId = selectedDrawing?.id ?? "";
    if (nextDrawingId !== selectedDrawingId) {
      const frame = window.requestAnimationFrame(() => setSelectedDrawingId(nextDrawingId));
      return () => window.cancelAnimationFrame(frame);
    }
  }, [selectedDrawing, selectedDrawingId]);

  function selectArea(area: TenantBuildingRecord) {
    const floors = sortFloors(model.floors.filter((floor) => floor.buildingId === area.id));
    setSelectedAreaId(area.id);
    setSelectedFloorId(area.hasFloors ? floors[0]?.id ?? "" : "");
  }

  function selectFloor(floor: TenantFloorRecord) {
    setSelectedAreaId(floor.buildingId);
    setSelectedFloorId(floor.id);
  }

  function openCreateAreaDialog() {
    setAreaForm(emptyAreaForm(areas.length + 1));
    setAreaFloorForms([emptyFloorForm(1)]);
    setDeletedFloorIds([]);
    setAreaDialogMode("create");
  }

  function openEditAreaDialog(area: TenantBuildingRecord) {
    const floorForms = sortFloors(model.floors.filter((floor) => floor.buildingId === area.id)).map(floorToForm);
    setAreaForm(areaToForm(area));
    setAreaFloorForms(area.hasFloors ? (floorForms.length ? floorForms : [emptyFloorForm(1)]) : []);
    setDeletedFloorIds([]);
    setAreaDialogMode("edit");
  }

  function manageAreaDrawings(area: TenantBuildingRecord) {
    selectArea(area);
    setActiveView("drawings");
  }

  function openUploadDialog() {
    if (!selectedArea) {
      setMessage("请先创建并选择区域。");
      return;
    }
    setUploadAreaId(selectedArea.id);
    setUploadFloorId(selectedArea.hasFloors ? selectedFloor?.id ?? floorsForArea[0]?.id ?? "" : "");
    setUploadForm(emptyUploadForm());
    setUploadProgress(0);
    setUploadProgressText("");
    setUploadDialogOpen(true);
  }

  function updateFloorFormRow(index: number, patch: Partial<FloorFormState>) {
    setAreaFloorForms((current) => current.map((floor, floorIndex) => (floorIndex === index ? { ...floor, ...patch } : floor)));
  }

  function removeFloorFormRow(index: number) {
    setAreaFloorForms((current) => {
      const target = current[index];
      if (target?.id) {
        setDeletedFloorIds((ids) => (ids.includes(target.id) ? ids : [...ids, target.id]));
      }
      return current.filter((_, floorIndex) => floorIndex !== index);
    });
  }

  function setAreaHasFloors(hasFloors: boolean) {
    setAreaForm((current) => ({ ...current, hasFloors }));
    setAreaFloorForms((current) => (hasFloors ? (current.length ? current : [emptyFloorForm(1)]) : current));
  }

  async function handleSaveArea() {
    if (!areaForm.name.trim()) {
      setMessage("请填写区域名称。");
      return;
    }
    if (areaForm.hasFloors && areaFloorForms.length === 0) {
      setMessage("请至少配置一个楼层，或将该区域切换为无楼层区域。");
      return;
    }
    if (areaForm.hasFloors && areaFloorForms.some((floor) => !floor.name.trim())) {
      setMessage("请填写每个楼层的名称。");
      return;
    }

    const isEdit = Boolean(areaForm.id);
    const deletedIds = areaForm.hasFloors
      ? deletedFloorIds
      : Array.from(new Set([...deletedFloorIds, ...areaFloorForms.map((floor) => floor.id).filter(Boolean)]));
    setSavingStructure(true);
    setMessage(null);
    const response = await fetch(isEdit ? `/api/tenant/spatial-areas/${areaForm.id}` : "/api/tenant/spatial-areas", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: areaForm.name.trim(),
        code: areaForm.code.trim(),
        areaType: areaForm.areaType,
        hasFloors: areaForm.hasFloors,
        sortOrder: areaForm.sortOrder,
        status: areaForm.status,
        description: areaForm.description.trim(),
        floors: areaForm.hasFloors
          ? areaFloorForms.map((floor, index) => ({
              id: floor.id || undefined,
              name: floor.name.trim(),
              code: floor.code.trim(),
              levelIndex: Number(floor.levelIndex || index + 1),
              sortOrder: Number(floor.sortOrder || index + 1),
              status: floor.status,
              description: floor.description.trim(),
            }))
          : [],
        deletedFloorIds: deletedIds,
      }),
    });
    setSavingStructure(false);

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      setMessage(
        result.code === "FLOOR_HAS_LINKED_DATA"
          ? "楼层已有图纸或历史点位，不能删除。请先处理关联图纸。"
          : result.code === "AREA_HAS_FLOORS"
            ? "该区域还有楼层，不能直接切换为无楼层区域。"
            : "区域保存失败，请检查名称、编码和楼层配置。",
      );
      return;
    }

    const result = (await response.json()) as { area: TenantBuildingRecord; floors?: TenantFloorRecord[] };
    await refresh();
    setSelectedAreaId(result.area.id);
    setSelectedFloorId(result.area.hasFloors ? result.floors?.[0]?.id ?? "" : "");
    setAreaDialogMode(null);
    setDeletedFloorIds([]);
    setMessage(isEdit ? "区域信息已更新。" : "区域已创建，可继续绑定图纸。");
  }

  async function handleDeleteArea(areaId: string) {
    const result = await confirmDialog({
      title: "删除区域",
      description: "确认删除该区域吗？已有楼层、图纸或点位的区域会被阻止删除。",
      confirmLabel: "删除",
      tone: "danger",
    });
    if (result !== "confirm") return;
    const response = await fetch(`/api/tenant/spatial-areas/${areaId}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage("区域删除失败：请先处理关联楼层、图纸和点位。");
      return;
    }
    await refresh();
    if (selectedAreaId === areaId) setSelectedAreaId("");
    setMessage("区域已删除。");
  }

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const isCadFile = /\.(dwg|dxf)$/i.test(file.name);
    if (isCadFile) {
      setUploadProgress(0);
      setUploadProgressText("");
      setMessage("请先在 CAD 软件中导出 PDF 后上传。");
      event.target.value = "";
      return;
    }

    setUploading(true);
    setMessage(null);
    setUploadProgress(1);
    setUploadProgressText("准备上传图纸文件...");
    setUploadForm((current) => ({
      ...current,
      fileName: "",
      fileUrl: "",
      sourceFileUrl: "",
      previewUrl: "",
      sceneUrl: "",
      fileSize: 0,
      processingStatus: "ready",
      processingMessage: "",
      conversionLog: [],
    }));
    try {
      const isPdfFile = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      const uploaded = await uploadDrawingFile(file, {
        onUploadProgress: (progress) => {
          setUploadProgress(progress);
          setUploadProgressText(`正在上传 ${progress}%`);
        },
        onServerProcessing: () => {
          setUploadProgress(100);
          setUploadProgressText(isPdfFile ? "上传完成，正在生成 PDF 预览..." : "上传完成，正在读取图片信息...");
        },
      });
      setUploadProgress(100);
      setUploadProgressText(uploaded.fileType === "pdf" ? "PDF 图纸处理完成，可以保存草稿。" : "图片上传完成，可以保存草稿。");
      setUploadForm((current) => ({
        ...current,
        fileName: uploaded.originalFileName,
        fileUrl: uploaded.fileUrl,
        sourceFileUrl: uploaded.sourceFileUrl,
        previewUrl: uploaded.previewUrl,
        sceneUrl: uploaded.sceneUrl,
        fileType: uploaded.fileType,
        fileSize: uploaded.fileSize,
        processingStatus: uploaded.processingStatus,
        processingMessage: uploaded.processingMessage,
        conversionLog: uploaded.conversionLog,
        width: uploaded.width,
        height: uploaded.height,
        name: current.name || uploaded.originalFileName.replace(/\.[^.]+$/, ""),
      }));
      setMessage(uploaded.processingStatus === "failed" ? uploaded.processingMessage : "文件已上传，保存草稿后可检查并发布。");
    } catch (error) {
      setUploadProgress(100);
      setUploadProgressText("图纸上传失败，请重新选择文件。");
      setMessage(error instanceof Error ? error.message : "图纸文件上传失败，请确认文件为图片或 PDF。");
    } finally {
      setUploading(false);
    }
  }

  async function handleUploadDrawing() {
    if (!uploadArea) {
      setMessage("请选择图纸所属区域。");
      return;
    }
    if (uploadArea.hasFloors && !uploadFloor) {
      setMessage("当前区域启用了楼层，请选择图纸所属楼层。");
      return;
    }
    if (!uploadForm.name.trim() || !uploadForm.fileUrl) {
      setMessage("请先上传图纸文件并填写图纸名称。");
      return;
    }

    setUploading(true);
    setUploadProgress((current) => Math.max(current, 30));
    setUploadProgressText("正在保存图纸草稿...");
    const response = await fetch("/api/tenant/drawings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        buildingId: uploadArea.id,
        floorId: uploadArea.hasFloors ? uploadFloor?.id : undefined,
        name: uploadForm.name.trim(),
        fileUrl: uploadForm.fileUrl,
        fileType: uploadForm.fileType,
        sourceFileUrl: uploadForm.sourceFileUrl,
        previewUrl: uploadForm.previewUrl,
        sceneUrl: uploadForm.sceneUrl,
        originalFileName: uploadForm.fileName,
        fileSize: uploadForm.fileSize,
        processingStatus: uploadForm.processingStatus,
        processingMessage: uploadForm.processingMessage,
        conversionLog: uploadForm.conversionLog,
        width: uploadForm.width,
        height: uploadForm.height,
        version: uploadForm.version || "v1.0",
        status: "draft",
      }),
    });
    setUploading(false);
    if (!response.ok) {
      setUploadProgressText("图纸草稿保存失败。");
      setMessage("图纸草稿保存失败。");
      return;
    }

    const result = (await response.json()) as { drawing: TenantDrawingRecord };
    setModel((current) => ({
      ...current,
      drawings: [result.drawing, ...current.drawings],
      summary: { ...current.summary, drawingCount: current.summary.drawingCount + 1 },
    }));
    setSelectedAreaId(uploadArea.id);
    setSelectedFloorId(uploadArea.hasFloors ? uploadFloor?.id ?? "" : "");
    setSelectedDrawingId(result.drawing.id);
    setUploadDialogOpen(false);
    setUploadForm(emptyUploadForm());
    setUploadProgress(0);
    setUploadProgressText("");
    setActiveView("publish");
    setMessage("图纸草稿已保存。确认图纸可正常显示后发布，大屏才会显示。");
  }

  async function handleDrawingStatus(drawingId: string, action: "publish" | "archive") {
    const targetDrawing = model.drawings.find((item) => item.id === drawingId);
    if (action === "publish" && targetDrawing?.processingStatus !== "ready") {
      setMessage("这张图纸还不能发布到大屏，请先完成转换或重新上传。");
      return;
    }
    const confirmText = action === "publish" ? "确认发布这张图纸到可视化大屏吗？" : "确认归档这张图纸吗？";
    const confirmResult = await confirmDialog({
      title: action === "publish" ? "发布图纸" : "归档图纸",
      description: confirmText,
      confirmLabel: action === "publish" ? "发布" : "归档",
      tone: action === "publish" ? "default" : "warning",
    });
    if (confirmResult !== "confirm") return;
    const response = await fetch(`/api/tenant/drawings/${drawingId}/${action}`, { method: "POST" });
    if (!response.ok) {
      setMessage(action === "publish" ? "图纸发布失败。" : "图纸归档失败。");
      return;
    }
    const result = (await response.json()) as { drawing: TenantDrawingRecord };
    setModel((current) => ({
      ...current,
      drawings: current.drawings.map((drawing) => (drawing.id === result.drawing.id ? result.drawing : drawing)),
    }));
    setMessage(action === "publish" ? "图纸已发布到可视化大屏。" : "图纸已归档，大屏不再默认显示。");
  }

  async function handleDeleteDrawing(drawingId: string) {
    const result = await confirmDialog({
      title: "删除图纸",
      description: "确认删除这张图纸吗？删除会级联移除该图纸上的历史点位。",
      confirmLabel: "删除",
      tone: "danger",
    });
    if (result !== "confirm") return;
    const response = await fetch(`/api/tenant/drawings?id=${encodeURIComponent(drawingId)}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage("图纸删除失败。");
      return;
    }
    setModel((current) => ({
      ...current,
      drawings: current.drawings.filter((drawing) => drawing.id !== drawingId),
      devicePoints: current.devicePoints.filter((point) => point.drawingId !== drawingId),
      summary: { ...current.summary, drawingCount: Math.max(current.summary.drawingCount - 1, 0) },
    }));
    if (selectedDrawingId === drawingId) setSelectedDrawingId("");
    setMessage("图纸已删除。");
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3 overflow-hidden">
      <section className="sf-panel rounded-[18px] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-[-0.02em] text-[color:var(--text-primary)]">区域管理</h1>
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--border-soft)] bg-[var(--panel-cell-bg)] text-sm font-semibold text-[color:var(--text-secondary)]"
                aria-label="查看帮助"
              >
                ?
              </button>
            </div>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">先维护区域和楼层，再绑定图纸并发布到可视化大屏。</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "区域", value: model.summary.buildingCount },
              { label: "楼层", value: model.summary.floorCount },
              { label: "图纸", value: model.summary.drawingCount },
              { label: "已发布", value: totalPublishedCount },
            ].map((item) => (
              <div key={item.label} className="sf-metric-block min-w-[96px] px-3 py-2">
                <p className="sf-label">{item.label}</p>
                <p className="mt-1 text-xl font-semibold leading-none text-[color:var(--text-primary)]">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {views.map((view) => (
            <button
              key={view.id}
              type="button"
              onClick={() => setActiveView(view.id)}
              title={view.description}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                activeView === view.id
                  ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]"
                  : "border-[color:var(--border-soft)] bg-[var(--panel-cell-bg)] text-[color:var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              }`}
            >
              {view.label}
            </button>
          ))}
        </div>
      </section>

      {message ? <div className="sf-glass rounded-[14px] px-4 py-3 text-sm text-[color:var(--accent-strong)]">{message}</div> : null}

      <div className="grid min-h-0 gap-2 xl:grid-cols-[300px_minmax(0,1fr)_320px] xl:overflow-hidden">
        <SectionCard title="区域导航" description="这里只负责切换区域和楼层，维护操作在区域结构里完成。" descriptionMode="tooltip" className="min-h-0 overflow-y-auto rounded-[18px]">
          <div className="space-y-2">
            {areas.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-5 text-sm text-[color:var(--text-muted)]">
                还没有区域，请先新增区域。
              </div>
            ) : null}
            {areas.map((area) => {
              const areaFloors = sortFloors(model.floors.filter((floor) => floor.buildingId === area.id));
              const areaDrawings = model.drawings.filter((drawing) => getDrawingAreaId(drawing, model.floors) === area.id);
              const counts = drawingCountsForTarget(areaDrawings);
              return (
                <div key={area.id} className={`rounded-[14px] border p-2 ${selectedAreaId === area.id ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]" : "border-[color:var(--border-soft)] bg-[var(--panel-cell-bg)]"}`}>
                  <button type="button" onClick={() => selectArea(area)} className="flex w-full items-start justify-between gap-3 text-left">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[color:var(--text-primary)]">{area.name}</span>
                      <span className="mt-1 block text-xs text-[color:var(--text-muted)]">{area.hasFloors ? `${areaFloors.length} 个楼层` : "区域平面"} / {areaDrawings.length} 张图纸</span>
                    </span>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${toneClass(area.status)}`}>{area.status === "active" ? "启用" : "停用"}</span>
                  </button>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-[color:var(--text-muted)]">
                    <span className="rounded-full border border-[color:var(--border-soft)] bg-[var(--surface-muted)] px-2 py-0.5">已发布 {counts.published}</span>
                    <span className="rounded-full border border-[color:var(--border-soft)] bg-[var(--surface-muted)] px-2 py-0.5">草稿 {counts.draft}</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {area.hasFloors ? (
                      areaFloors.map((floor) => (
                        <button
                          key={floor.id}
                          type="button"
                          onClick={() => selectFloor(floor)}
                          className={`w-full rounded-[10px] px-3 py-2 text-left text-xs ${
                            selectedFloorId === floor.id ? "bg-[var(--panel-cell-bg)] text-[color:var(--accent-strong)]" : "bg-[var(--surface-muted)] text-[color:var(--text-secondary)]"
                          }`}
                        >
                          {floor.name} / {floor.status === "active" ? "启用" : "停用"}
                        </button>
                      ))
                    ) : (
                      <button type="button" onClick={() => selectArea(area)} className="w-full rounded-[10px] bg-[var(--surface-muted)] px-3 py-2 text-left text-xs text-[color:var(--text-secondary)]">
                        区域平面 / {areaDrawings.filter((drawing) => !drawing.floorId).length} 张图纸
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <main className="min-h-0 overflow-hidden">
          {activeView === "structure" ? (
            <SectionCard
              title="区域结构"
              description="区域和楼层的唯一维护入口。楼层作为区域属性，在新增或编辑区域弹窗中配置。"
              descriptionMode="tooltip"
              extra={<button type="button" onClick={openCreateAreaDialog} className="sf-button sf-button-primary h-9 px-3 text-xs">新增区域</button>}
              className="h-full overflow-y-auto rounded-[18px]"
            >
              <div className="sf-table-shell overflow-x-auto">
                <table className="min-w-[980px] text-left text-sm">
                  <thead className="sf-table-head">
                    <tr>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em]">区域名称</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em]">编码/类型</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em]">楼层配置</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em]">图纸绑定</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em]">发布状态</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em]">启用状态</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em]">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-[var(--table-row)]">
                    {areas.map((area, index) => {
                      const areaFloors = sortFloors(model.floors.filter((floor) => floor.buildingId === area.id));
                      const areaDrawings = model.drawings.filter((drawing) => getDrawingAreaId(drawing, model.floors) === area.id);
                      const counts = drawingCountsForTarget(areaDrawings);
                      return (
                        <tr key={area.id} className="border-t border-[color:var(--border-soft)] hover:bg-[var(--surface-muted)]" style={{ backgroundColor: index % 2 === 0 ? "var(--table-row)" : "var(--table-row-alt)" }}>
                          <td className="max-w-[220px] px-4 py-3">
                            <button type="button" onClick={() => selectArea(area)} className="min-w-0 text-left">
                              <p className="truncate font-semibold text-[color:var(--text-primary)]">{area.name}</p>
                              <p className="mt-1 truncate text-xs text-[color:var(--text-muted)]">{area.description || "暂无说明"}</p>
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-[color:var(--text-primary)]">{area.code || "未设置"}</p>
                            <p className="mt-1 text-xs text-[color:var(--text-muted)]">{areaTypeLabel(area.areaType)}</p>
                          </td>
                          <td className="max-w-[250px] px-4 py-3">
                            {area.hasFloors ? (
                              <div className="flex flex-wrap gap-1.5">
                                {areaFloors.length ? areaFloors.map((floor) => (
                                  <button key={floor.id} type="button" onClick={() => selectFloor(floor)} className={`rounded-full border px-2 py-1 text-[11px] ${floor.status === "active" ? "border-[color:var(--border-soft)] bg-[var(--surface-muted)] text-[color:var(--text-secondary)]" : toneClass("inactive")}`}>
                                    {floor.name}
                                  </button>
                                )) : <span className="text-xs text-[color:var(--warning-strong)]">未配置楼层</span>}
                              </div>
                            ) : (
                              <span className="rounded-full border border-[color:var(--border-soft)] bg-[var(--surface-muted)] px-2 py-1 text-xs text-[color:var(--text-secondary)]">区域平面</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-[color:var(--text-secondary)]">
                            <p>{counts.total} 张图纸</p>
                            <p className="mt-1 text-xs text-[color:var(--text-muted)]">草稿 {counts.draft} / 已发布 {counts.published}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full border px-2 py-1 text-xs ${counts.published > 0 ? toneClass("published") : toneClass("draft")}`}>{counts.published > 0 ? "已有发布图纸" : "未发布图纸"}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full border px-2 py-1 text-xs ${toneClass(area.status)}`}>{area.status === "active" ? "启用" : "停用"}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={() => openEditAreaDialog(area)} className={smallButtonClass}>编辑区域</button>
                              <button type="button" onClick={() => manageAreaDrawings(area)} className={smallButtonClass}>管理图纸</button>
                              <button type="button" onClick={() => handleDeleteArea(area.id)} className="sf-button sf-button-danger h-8 px-3 text-xs">删除</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {areas.length === 0 ? (
                <div className="mt-4 rounded-[16px] border border-dashed border-[color:var(--border)] bg-[var(--surface-muted)] px-5 py-8 text-center text-sm text-[color:var(--text-muted)]">
                  点击“新增区域”创建厂房、仓库、泵房、办公楼或室外区域。
                </div>
              ) : null}
            </SectionCard>
          ) : null}

          {activeView === "drawings" ? (
            <SectionCard
              title="图纸绑定"
              description="先选择区域或楼层，再上传图纸草稿。草稿不会进入大屏，发布后才会显示。"
              descriptionMode="tooltip"
              extra={<button type="button" onClick={openUploadDialog} className="sf-button sf-button-primary h-9 px-3 text-xs">上传图纸</button>}
              className="h-full overflow-y-auto rounded-[18px]"
            >
              <div className="mb-3 grid gap-2 rounded-[14px] border border-[color:var(--border-soft)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[color:var(--text-secondary)] lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
                <div>当前目标：<span className="font-semibold text-[color:var(--text-primary)]">{targetLabel(selectedArea, selectedFloor)}</span></div>
                {selectedArea?.hasFloors ? (
                  <select className={inputClassName} value={selectedFloorId} onChange={(event) => setSelectedFloorId(event.target.value)}>
                    <option value="">请选择楼层</option>
                    {floorsForArea.map((floor) => (
                      <option key={floor.id} value={floor.id}>{floor.name} / {floor.status === "active" ? "启用" : "停用"}</option>
                    ))}
                  </select>
                ) : null}
              </div>
              <div className="sf-table-shell overflow-x-auto">
                <table className="min-w-[760px] text-left text-sm">
                  <thead className="sf-table-head">
                    <tr>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em]">图纸名称</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em]">类型/版本</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em]">状态</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em]">更新时间</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em]">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-[var(--table-row)]">
                    {targetDrawings.map((drawing, index) => (
                      <tr key={drawing.id} className="border-t border-[color:var(--border-soft)] hover:bg-[var(--surface-muted)]" style={{ backgroundColor: index % 2 === 0 ? "var(--table-row)" : "var(--table-row-alt)" }}>
                        <td className="max-w-[280px] px-4 py-3">
                          <button type="button" onClick={() => { setSelectedDrawingId(drawing.id); setActiveView("publish"); }} className="min-w-0 text-left">
                            <p className="truncate font-semibold text-[color:var(--text-primary)]">{drawing.name}</p>
                            <p className="mt-1 truncate text-xs text-[color:var(--text-muted)]">{drawing.originalFileName || drawing.fileUrl}</p>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-[color:var(--text-secondary)]">{drawing.fileType.toUpperCase()} / {drawing.version}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            <span className={`rounded-full border px-2 py-1 text-xs ${toneClass(drawing.status)}`}>{drawingStatusLabel(drawing.status)}</span>
                            <span className={`rounded-full border px-2 py-1 text-xs ${toneClass(drawing.processingStatus)}`}>{processingStatusLabel(drawing.processingStatus)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-[color:var(--text-muted)]">{drawing.updatedAt}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => { setSelectedDrawingId(drawing.id); setActiveView("publish"); }} className={smallButtonClass}>检查</button>
                            {drawing.status !== "published" ? (
                              <button type="button" onClick={() => handleDrawingStatus(drawing.id, "publish")} disabled={drawing.processingStatus !== "ready"} className="sf-button sf-button-primary h-8 px-3 text-xs disabled:opacity-50">发布</button>
                            ) : (
                              <button type="button" onClick={() => handleDrawingStatus(drawing.id, "archive")} className={smallButtonClass}>归档</button>
                            )}
                            <button type="button" onClick={() => handleDeleteDrawing(drawing.id)} className="sf-button sf-button-danger h-8 px-3 text-xs">删除</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {targetDrawings.length === 0 ? (
                <div className="mt-4 rounded-[16px] border border-dashed border-[color:var(--border)] bg-[var(--surface-muted)] px-5 py-8 text-center text-sm text-[color:var(--text-muted)]">
                  当前区域/楼层还没有图纸。点击“上传图纸”保存第一张草稿。
                </div>
              ) : null}
            </SectionCard>
          ) : null}

          {activeView === "publish" ? (
            <SectionCard
              title="发布检查"
              description="用这里判断当前图纸为什么会或不会显示在可视化大屏。"
              descriptionMode="tooltip"
              extra={selectedDrawing ? (
                selectedDrawing.status !== "published" ? (
                  <button type="button" onClick={() => handleDrawingStatus(selectedDrawing.id, "publish")} disabled={selectedDrawing.processingStatus !== "ready"} className="sf-button sf-button-primary h-9 px-3 text-xs disabled:opacity-50">发布当前图纸</button>
                ) : (
                  <button type="button" onClick={() => handleDrawingStatus(selectedDrawing.id, "archive")} className="sf-button sf-button-secondary h-9 px-3 text-xs">归档当前图纸</button>
                )
              ) : null}
              className="h-full overflow-y-auto rounded-[18px]"
            >
              <div className="grid gap-3 md:grid-cols-2">
                <InfoBlock label="当前图纸" value={selectedDrawing?.name ?? "未选择图纸"} detail={selectedDrawing ? drawingTargetLabel(selectedDrawing, areas, model.floors) : "请先选择区域/楼层并上传图纸"} />
                <InfoBlock label="大屏默认图纸" value={publishedTargetDrawing?.name ?? "当前目标没有已发布图纸"} detail={publishedTargetDrawing ? "大屏会默认显示最新发布版本。" : "没有已发布图纸时，大屏会显示降级拓扑视图。"} />
                <div className="rounded-[16px] border border-[color:var(--border-soft)] bg-[var(--panel-cell-bg)] p-4">
                  <p className="sf-label">发布状态</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs ${toneClass(selectedDrawing?.status ?? "archived")}`}>{selectedDrawing ? drawingStatusLabel(selectedDrawing.status) : "未选择"}</span>
                    {selectedDrawing ? <span className={`rounded-full border px-3 py-1 text-xs ${toneClass(selectedDrawing.processingStatus)}`}>{processingStatusLabel(selectedDrawing.processingStatus)}</span> : null}
                  </div>
                </div>
                <InfoBlock label="图纸文件" value={selectedDrawing ? selectedDrawing.fileType.toUpperCase() : "未选择"} detail={selectedDrawing ? selectedDrawing.originalFileName || formatFileSize(selectedDrawing.fileSize) : "请先上传图纸草稿"} />
              </div>
              <div className="mt-4 rounded-[16px] border border-[color:var(--border-soft)] bg-[var(--surface-muted)] p-4 text-sm leading-6 text-[color:var(--text-secondary)]">
                {!selectedDrawing
                  ? "当前没有选择图纸：请先上传草稿，再检查并发布。"
                  : selectedDrawing.processingStatus !== "ready"
                    ? selectedDrawing.processingMessage || "当前图纸转换未完成，不能发布到大屏。"
                    : selectedDrawing.status === "published"
                      ? "当前图纸已发布：可视化大屏会在该区域/楼层下显示最新发布图纸。"
                      : selectedDrawing.status === "archived"
                        ? "当前图纸已归档：大屏不会默认显示它。"
                        : "当前图纸仍是草稿：不会影响大屏。确认图纸可正常显示后点击发布。"}
              </div>
              {selectedDrawing ? (
                <div className="sf-cad-screen relative mt-4 min-h-[360px] overflow-hidden rounded-[20px] sm:min-h-[460px]">
                  <DrawingSurface drawing={selectedDrawing} />
                </div>
              ) : null}
            </SectionCard>
          ) : null}
        </main>

        <aside className="grid min-h-0 gap-2 overflow-hidden">
          <SectionCard title="当前摘要" description="只显示当前目标信息，不堆叠编辑表单。" descriptionMode="tooltip" className="min-h-0 overflow-y-auto rounded-[18px]">
            <div className="space-y-3 text-sm">
              <InfoBlock label="区域/楼层" value={targetLabel(selectedArea, selectedFloor)} detail={selectedArea ? `${areaTypeLabel(selectedArea.areaType)} / ${selectedArea.status === "active" ? "启用" : "停用"}` : "未选择区域"} />
              <div className="rounded-[14px] border border-[color:var(--border-soft)] bg-[var(--panel-cell-bg)] p-3">
                <p className="sf-label">当前图纸</p>
                <p className="mt-2 truncate font-semibold text-[color:var(--text-primary)]">{selectedDrawing?.name ?? "未选择图纸"}</p>
                {selectedDrawing ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] ${toneClass(selectedDrawing.status)}`}>{drawingStatusLabel(selectedDrawing.status)}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] ${toneClass(selectedDrawing.processingStatus)}`}>{processingStatusLabel(selectedDrawing.processingStatus)}</span>
                  </div>
                ) : null}
              </div>
              <div className="rounded-[14px] border border-[color:var(--border-soft)] bg-[var(--panel-cell-bg)] p-3">
                <p className="sf-label">图纸清单</p>
                <div className="mt-3 space-y-2">
                  {targetDrawings.slice(0, 8).map((drawing) => (
                    <button key={drawing.id} type="button" onClick={() => setSelectedDrawingId(drawing.id)} className="block w-full rounded-[10px] bg-[var(--surface-muted)] px-3 py-2 text-left">
                      <span className="block truncate text-xs font-semibold text-[color:var(--text-primary)]">{drawing.name}</span>
                      <span className="mt-1 block truncate text-[11px] text-[color:var(--text-muted)]">{drawing.fileType.toUpperCase()} / {drawingStatusLabel(drawing.status)}</span>
                    </button>
                  ))}
                  {targetDrawings.length === 0 ? <p className="text-xs text-[color:var(--text-muted)]">当前目标暂无图纸。</p> : null}
                </div>
              </div>
            </div>
          </SectionCard>
        </aside>
      </div>

      <Dialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        eyebrow="使用帮助"
        title="如何使用区域管理"
        description="这个页面用于把企业自己的区域结构和建筑图纸发布到可视化大屏。"
        footer={<button type="button" onClick={() => setHelpOpen(false)} className="sf-button sf-button-primary h-10 px-4 text-sm">我知道了</button>}
      >
        <div className="space-y-4 text-sm leading-6 text-[color:var(--text-secondary)]">
          <InfoParagraph title="1. 先建区域和楼层" text="把企业空间拆成厂房、仓库、泵房、办公楼或室外区域。楼层是区域的属性，请在新增或编辑区域弹窗里配置。" />
          <InfoParagraph title="2. 再上传图纸草稿" text="在选中的区域或楼层下上传 PDF 或图片文件。CAD 图纸请先在 CAD 软件中导出 PDF 后上传。" />
          <InfoParagraph title="3. 最后发布到大屏" text="进入发布检查确认图纸可正常显示，再点击发布。同一区域或楼层有多张已发布图纸时，大屏默认使用最新发布的一张。" />
        </div>
      </Dialog>

      <Dialog
        open={areaDialogMode !== null}
        onClose={() => setAreaDialogMode(null)}
        eyebrow="区域管理"
        title={areaDialogMode === "edit" ? "编辑区域" : "新增区域"}
        description="区域代表企业空间中的厂房、仓库、泵房、办公楼或室外平面。"
        footer={
          <>
            <button type="button" onClick={() => setAreaDialogMode(null)} className="sf-button sf-button-secondary h-10 px-4 text-sm">取消</button>
            <button type="button" onClick={handleSaveArea} disabled={savingStructure} className="sf-button sf-button-primary h-10 px-4 text-sm disabled:opacity-60">{savingStructure ? "保存中..." : "保存区域"}</button>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2"><span className="text-sm text-[color:var(--text-secondary)]">区域名称</span><input className={inputClassName} value={areaForm.name} onChange={(event) => setAreaForm((current) => ({ ...current, name: event.target.value }))} placeholder="例如：1号厂房" /></label>
          <label className="space-y-2"><span className="text-sm text-[color:var(--text-secondary)]">区域编码</span><input className={inputClassName} value={areaForm.code} onChange={(event) => setAreaForm((current) => ({ ...current, code: event.target.value }))} placeholder="例如：HX-A" /></label>
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">区域类型</span>
            <select className={inputClassName} value={areaForm.areaType} onChange={(event) => setAreaForm((current) => ({ ...current, areaType: event.target.value }))}>
              <option value="factory">厂房</option>
              <option value="warehouse">仓库</option>
              <option value="pump">泵房</option>
              <option value="office">办公楼</option>
              <option value="outdoor">室外区域</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">启用状态</span>
            <select className={inputClassName} value={areaForm.status} onChange={(event) => setAreaForm((current) => ({ ...current, status: event.target.value as AreaFormState["status"] }))}>
              <option value="active">启用</option>
              <option value="inactive">停用</option>
            </select>
          </label>
          <label className="space-y-2"><span className="text-sm text-[color:var(--text-secondary)]">排序</span><input className={inputClassName} type="number" value={areaForm.sortOrder} onChange={(event) => setAreaForm((current) => ({ ...current, sortOrder: Number(event.target.value) }))} /></label>
          <label className="sf-checkrow px-4 py-3"><input type="checkbox" checked={areaForm.hasFloors} onChange={(event) => setAreaHasFloors(event.target.checked)} /><span className="text-sm text-[color:var(--text-primary)]">该区域有楼层</span></label>
          <label className="space-y-2 md:col-span-2"><span className="text-sm text-[color:var(--text-secondary)]">说明</span><textarea className="sf-input min-h-24 px-3 py-3 text-sm" value={areaForm.description} onChange={(event) => setAreaForm((current) => ({ ...current, description: event.target.value }))} placeholder="可填写区域用途、边界或管理备注" /></label>
          {areaForm.hasFloors ? (
            <div className="space-y-3 md:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--text-primary)]">楼层配置</p>
                  <p className="mt-1 text-xs text-[color:var(--text-muted)]">删除已有楼层时，如果已有图纸或历史点位，保存会被系统阻止。</p>
                </div>
                <button type="button" onClick={() => setAreaFloorForms((current) => [...current, emptyFloorForm(current.length + 1)])} className="sf-button sf-button-secondary h-9 px-3 text-xs">添加楼层配置行</button>
              </div>
              <div className="space-y-2">
                {areaFloorForms.map((floor, index) => (
                  <div key={floor.id || `new-${index}`} className="rounded-[14px] border border-[color:var(--border-soft)] bg-[var(--surface-muted)] p-3">
                    <div className="grid gap-2 lg:grid-cols-[1.15fr_1fr_0.75fr_0.75fr_0.9fr_auto]">
                      <label className="space-y-1"><span className="text-xs text-[color:var(--text-muted)]">楼层名称</span><input className={inputClassName} value={floor.name} onChange={(event) => updateFloorFormRow(index, { name: event.target.value })} placeholder="例如：1层" /></label>
                      <label className="space-y-1"><span className="text-xs text-[color:var(--text-muted)]">编码</span><input className={inputClassName} value={floor.code} onChange={(event) => updateFloorFormRow(index, { code: event.target.value })} placeholder="HX-A-1" /></label>
                      <label className="space-y-1"><span className="text-xs text-[color:var(--text-muted)]">楼层号</span><input className={inputClassName} type="number" value={floor.levelIndex} onChange={(event) => updateFloorFormRow(index, { levelIndex: Number(event.target.value) })} /></label>
                      <label className="space-y-1"><span className="text-xs text-[color:var(--text-muted)]">排序</span><input className={inputClassName} type="number" value={floor.sortOrder} onChange={(event) => updateFloorFormRow(index, { sortOrder: Number(event.target.value) })} /></label>
                      <label className="space-y-1"><span className="text-xs text-[color:var(--text-muted)]">状态</span><select className={inputClassName} value={floor.status} onChange={(event) => updateFloorFormRow(index, { status: event.target.value as FloorFormState["status"] })}><option value="active">启用</option><option value="inactive">停用</option></select></label>
                      <button type="button" onClick={() => removeFloorFormRow(index)} className="sf-button sf-button-danger h-10 self-end px-3 text-xs">删除</button>
                    </div>
                    <label className="mt-2 block space-y-1"><span className="text-xs text-[color:var(--text-muted)]">说明</span><input className={inputClassName} value={floor.description} onChange={(event) => updateFloorFormRow(index, { description: event.target.value })} placeholder="可填写楼层用途或备注" /></label>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Dialog>

      <Dialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        eyebrow="区域管理"
        title="上传图纸草稿"
        description="图纸会先保存为草稿，发布后才会进入可视化大屏。推荐上传 CAD 导出的 PDF 图纸，也支持 PNG/JPG 等图片。"
        footer={
          <>
            <button type="button" onClick={() => setUploadDialogOpen(false)} disabled={uploading} className="sf-button sf-button-secondary h-10 px-4 text-sm">取消</button>
            <button type="button" onClick={handleUploadDrawing} disabled={uploading} className="sf-button sf-button-primary h-10 px-4 text-sm disabled:opacity-60">{uploading ? "处理中..." : "保存草稿"}</button>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">所属区域</span>
            <select className={inputClassName} value={uploadAreaId} onChange={(event) => {
              const areaId = event.target.value;
              const area = areas.find((item) => item.id === areaId);
              const floors = sortFloors(model.floors.filter((floor) => floor.buildingId === areaId));
              setUploadAreaId(areaId);
              setUploadFloorId(area?.hasFloors ? floors[0]?.id ?? "" : "");
            }}>
              <option value="">请选择区域</option>
              {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">所属楼层</span>
            {uploadArea?.hasFloors ? (
              <select className={inputClassName} value={uploadFloorId} onChange={(event) => setUploadFloorId(event.target.value)}>
                <option value="">请选择楼层</option>
                {uploadFloors.map((floor) => <option key={floor.id} value={floor.id}>{floor.name}</option>)}
              </select>
            ) : (
              <div className="flex h-10 items-center rounded-[10px] border border-[color:var(--border-soft)] bg-[var(--surface-muted)] px-3 text-sm text-[color:var(--text-secondary)]">区域平面</div>
            )}
          </label>
          <label className="space-y-2"><span className="text-sm text-[color:var(--text-secondary)]">图纸名称</span><input className={inputClassName} value={uploadForm.name} onChange={(event) => setUploadForm((current) => ({ ...current, name: event.target.value }))} placeholder="例如：1层消防平面图" /></label>
          <label className="space-y-2"><span className="text-sm text-[color:var(--text-secondary)]">版本号</span><input className={inputClassName} value={uploadForm.version} onChange={(event) => setUploadForm((current) => ({ ...current, version: event.target.value }))} placeholder="例如：v1.0" /></label>
          <label className="space-y-2 md:col-span-2"><span className="text-sm text-[color:var(--text-secondary)]">图纸文件</span><input type="file" accept="image/*,application/pdf,.pdf" onChange={handleFileSelect} className={inputClassName} /></label>
          {uploadProgress > 0 ? (
            <div className="rounded-[14px] border border-[color:var(--border-soft)] bg-[var(--panel-cell-bg)] px-4 py-3 md:col-span-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium text-[color:var(--text-primary)]">{uploadProgressText || "正在处理图纸..."}</span>
                <span className="shrink-0 text-xs font-semibold text-[color:var(--text-secondary)]">{uploadProgress}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${uploadForm.processingStatus === "failed" ? "bg-[var(--danger)]" : "bg-[var(--accent)]"}`}
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              {uploading ? (
                <p className="mt-2 text-xs text-[color:var(--text-secondary)]">PDF 会在上传完成后生成首页预览，请保持当前弹窗打开。</p>
              ) : null}
            </div>
          ) : null}
          <div className="rounded-[14px] border border-[color:var(--border-soft)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[color:var(--text-secondary)] md:col-span-2">
            {uploadForm.fileName ? `${uploadForm.fileName} / ${uploadForm.fileType.toUpperCase()} / ${formatFileSize(uploadForm.fileSize)} / ${uploadForm.width} x ${uploadForm.height}` : "尚未选择图纸文件"}
          </div>
          {uploadForm.processingStatus !== "ready" && uploadForm.processingMessage ? (
            <AlertMessage tone="warning" className="md:col-span-2">{uploadForm.processingMessage}</AlertMessage>
          ) : null}
        </div>
      </Dialog>
    </div>
  );
}

function InfoBlock({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-[16px] border border-[color:var(--border-soft)] bg-[var(--panel-cell-bg)] p-4">
      <p className="sf-label">{label}</p>
      <p className="mt-2 truncate text-base font-semibold text-[color:var(--text-primary)]">{value}</p>
      {detail ? <p className="mt-2 truncate text-sm text-[color:var(--text-secondary)]">{detail}</p> : null}
    </div>
  );
}

function InfoParagraph({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[16px] border border-[color:var(--border-soft)] bg-[var(--panel-cell-bg)] p-4">
      <p className="font-semibold text-[color:var(--text-primary)]">{title}</p>
      <p className="mt-2">{text}</p>
    </div>
  );
}
