"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Dialog } from "@/components/ui/dialog";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { AlertMessage } from "@/components/ui/alert-message";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { useToast } from "@/components/ui/toast-center";
import { getTenantEventBus } from "@/lib/realtime/event-bus";

type DeviceStatus = "正常" | "报警" | "故障" | "离线" | "维修中";
type DeviceStatusFilter = DeviceStatus | "全部";
type AttributeType = "auto" | "text" | "number" | "date" | "boolean";
type DuplicatePolicy = "skip" | "update" | "error";
type DeviceLifecycleStatus = "active" | "disabled";
type DeviceLifecycleFilter = DeviceLifecycleStatus | "all";
type DeviceLifecycleAction = "disable" | "restore";

type DeviceRecord = {
  id: string;
  deviceCode: string;
  name: string;
  type: string;
  area: string;
  installationLocation: string;
  location: string;
  status: DeviceStatus;
  installationStatus: string;
  lastReportAt: string;
  notes: string;
  customAttributes?: Record<string, string | number | boolean | null>;
  lifecycleStatus: DeviceLifecycleStatus;
  disabledAt?: string;
  disabledReason?: string;
};

type DeviceAttributeDefinition = {
  tenantId: string;
  fieldKey: string;
  label: string;
  fieldType: AttributeType;
  required: boolean;
  enabled: boolean;
  showInList: boolean;
  sortOrder: number;
  isCore: boolean;
};

type DeviceFormState = {
  id?: string;
  deviceCode: string;
  name: string;
  type: string;
  area: string;
  installationLocation: string;
  status: DeviceStatus;
  installationStatus: string;
  lastReportAt: string;
  notes: string;
  customAttributes: Record<string, string | number | boolean | null>;
};

type AttributeFormState = {
  fieldKey?: string;
  label: string;
  fieldType: AttributeType;
  required: boolean;
  showInList: boolean;
  sortOrder: number;
};

type DeviceImportRow = {
  rowNumber: number;
  values: Record<string, string>;
};

type DeviceImportPreview = {
  fileName: string;
  headers: string[];
  rows: DeviceImportRow[];
  previewRows: DeviceImportRow[];
  totalRows: number;
  importableRows: number;
  duplicateRows: number;
  errors: { rowNumber: number; message: string }[];
  missingHeaders: string[];
  unknownHeaders: string[];
  created?: number;
  updated?: number;
  skipped?: number;
};

type DeviceLifecyclePreview = {
  action: DeviceLifecycleAction;
  total: number;
  updateable: number;
  skipped: number;
  missing: number;
  pointCount: number;
  openAlarmCount: number;
  rawEventCount: number;
  maintenanceRecordCount: number;
  devices: {
    deviceId: string;
    deviceCode: string;
    name: string;
    lifecycleStatus: DeviceLifecycleStatus;
    pointCount: number;
    openAlarmCount: number;
    rawEventCount: number;
    maintenanceRecordCount: number;
    canUpdate: boolean;
    message: string;
  }[];
  updated?: number;
  failed?: number;
  results?: { deviceId: string; status: "updated" | "skipped" | "failed"; message: string }[];
};

const statusFilters: DeviceStatusFilter[] = ["全部", "正常", "报警", "故障", "离线", "维修中"];
const lifecycleFilters: { value: DeviceLifecycleFilter; label: string }[] = [
  { value: "active", label: "启用" },
  { value: "disabled", label: "停用" },
  { value: "all", label: "全部" },
];
const deviceStatuses: DeviceStatus[] = ["正常", "报警", "故障", "离线", "维修中"];
const installationStatusOptions = ["", "已安装", "未安装", "停用", "未知"];
const pageSize = 10;
const inputClassName = "sf-input h-11 px-4 text-sm";

function formatLocalTimestamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function createEmptyDeviceForm(): DeviceFormState {
  return {
    deviceCode: "",
    name: "",
    type: "",
    area: "",
    installationLocation: "",
    status: "正常",
    installationStatus: "已安装",
    lastReportAt: formatLocalTimestamp(),
    notes: "",
    customAttributes: {},
  };
}

function createEmptyAttributeForm(nextSortOrder = 100): AttributeFormState {
  return {
    label: "",
    fieldType: "auto",
    required: false,
    showInList: false,
    sortOrder: nextSortOrder,
  };
}

function toFormState(device: DeviceRecord): DeviceFormState {
  return {
    id: device.id,
    deviceCode: device.deviceCode ?? "",
    name: device.name,
    type: device.type,
    area: device.area,
    installationLocation: device.installationLocation,
    status: device.status,
    installationStatus: device.installationStatus ?? "",
    lastReportAt: device.lastReportAt,
    notes: device.notes,
    customAttributes: { ...(device.customAttributes ?? {}) },
  };
}

function requiredLabel(label: string, required: boolean) {
  return (
    <span className="flex items-center gap-1 text-sm text-[color:var(--text-secondary)]">
      {label}
      {required ? <span className="text-[color:var(--danger-strong)]">*</span> : null}
    </span>
  );
}

function getDeviceFieldValue(device: DeviceRecord, attribute: DeviceAttributeDefinition) {
  if (attribute.isCore) {
    if (attribute.fieldKey === "location") return device.location;
    return String((device as unknown as Record<string, unknown>)[attribute.fieldKey] ?? "");
  }
  return String(device.customAttributes?.[attribute.fieldKey] ?? "");
}

function getFormFieldValue(formState: DeviceFormState, attribute: DeviceAttributeDefinition) {
  if (attribute.isCore) {
    return String((formState as unknown as Record<string, unknown>)[attribute.fieldKey] ?? "");
  }
  return String(formState.customAttributes[attribute.fieldKey] ?? "");
}

function fieldClassName(hasError: boolean) {
  return `${inputClassName} ${
    hasError ? "border-[color:var(--danger)] text-[color:var(--danger-strong)] focus:border-[color:var(--danger)]" : ""
  }`;
}

function fieldTypeLabel(type: AttributeType) {
  if (type === "auto") return "自动";
  if (type === "text") return "文本";
  if (type === "number") return "数字";
  if (type === "date") return "日期";
  return "布尔";
}

export function DeviceManager({ initialDeviceId }: { initialDeviceId?: string }) {
  const { confirmDialog } = useConfirmDialog();
  const { pushToast } = useToast();
  const router = useRouter();
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [attributes, setAttributes] = useState<DeviceAttributeDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchValue, setSearchValue] = useState("");
  const [activeFilter, setActiveFilter] = useState<DeviceStatusFilter>("全部");
  const [lifecycleFilter, setLifecycleFilter] = useState<DeviceLifecycleFilter>("active");
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view" | "fields" | "fieldForm" | "import" | "lifecycle" | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<DeviceRecord | null>(null);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [formState, setFormState] = useState<DeviceFormState>(() => createEmptyDeviceForm());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [attributeForm, setAttributeForm] = useState<AttributeFormState>(() => createEmptyAttributeForm());
  const [attributeError, setAttributeError] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<DeviceImportPreview | null>(null);
  const [importError, setImportError] = useState("");
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState("");
  const [importSuccess, setImportSuccess] = useState("");
  const [duplicatePolicy, setDuplicatePolicy] = useState<DuplicatePolicy>("error");
  const [lifecycleAction, setLifecycleAction] = useState<DeviceLifecycleAction>("disable");
  const [lifecycleReason, setLifecycleReason] = useState("");
  const [lifecyclePreview, setLifecyclePreview] = useState<DeviceLifecyclePreview | null>(null);
  const [lifecycleError, setLifecycleError] = useState("");
  const [lifecycleProgress, setLifecycleProgress] = useState(0);
  const [lifecycleStatus, setLifecycleStatus] = useState("");
  const [lifecycleSuccess, setLifecycleSuccess] = useState("");
  const [page, setPage] = useState(1);
  const isRefreshingRef = useRef(false);
  const pendingRefreshRef = useRef(false);
  const editingAttribute = useMemo(
    () => attributes.find((attribute) => attribute.fieldKey === attributeForm.fieldKey) ?? null,
    [attributeForm.fieldKey, attributes],
  );

  const loadDevices = useCallback(async () => {
    if (isRefreshingRef.current) {
      pendingRefreshRef.current = true;
      return;
    }
    isRefreshingRef.current = true;

    try {
      do {
        pendingRefreshRef.current = false;
        const [devicesResponse, attributesResponse] = await Promise.all([
          fetch(`/api/tenant/devices?lifecycle=${encodeURIComponent(lifecycleFilter)}`, { cache: "no-store" }),
          fetch("/api/tenant/device-attributes", { cache: "no-store" }),
        ]);
        if (!devicesResponse.ok || !attributesResponse.ok) {
          setLoading(false);
          return;
        }
        const devicesPayload = (await devicesResponse.json()) as { devices: DeviceRecord[] };
        const attributesPayload = (await attributesResponse.json()) as { attributes: DeviceAttributeDefinition[] };
        const nextDevices = devicesPayload.devices ?? [];
        setDevices(nextDevices);
        setAttributes((attributesPayload.attributes ?? []).sort((a, b) => a.sortOrder - b.sortOrder));
        setSelectedDevice((current) => (current ? nextDevices.find((device) => device.id === current.id) ?? null : current));
        setSelectedDeviceIds((current) => current.filter((id) => nextDevices.some((device) => device.id === id)));
        setLoading(false);
      } while (pendingRefreshRef.current);
    } finally {
      isRefreshingRef.current = false;
    }
  }, [lifecycleFilter]);

  useEffect(() => {
    const pollTimer = window.setInterval(() => {
      void loadDevices();
    }, 30000);
    const handleFocus = () => void loadDevices();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadDevices();
      }
    };

    void loadDevices();
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(pollTimer);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadDevices]);

  useEffect(() => {
    const bus = getTenantEventBus();
    return bus.subscribe({
      types: ["alarm_created", "alarm_updated", "device_status_changed", "system_alert"],
      onEvent: () => {
        void loadDevices();
      },
    });
  }, [loadDevices]);

  const enabledAttributes = useMemo(() => attributes.filter((attribute) => attribute.enabled), [attributes]);
  const listAttributes = useMemo(() => enabledAttributes.filter((attribute) => attribute.showInList), [enabledAttributes]);

  const filteredDevices = useMemo(() => {
    return devices.filter((device) => {
      const matchStatus = activeFilter === "全部" ? true : device.status === activeFilter;
      const keyword = searchValue.trim().toLowerCase();
      const customText = Object.values(device.customAttributes ?? {}).join(" ");
      const matchKeyword =
        keyword.length === 0
          ? true
          : [
              device.deviceCode,
              device.name,
              device.type,
              device.area,
              device.installationLocation,
              device.installationStatus,
              device.status,
              customText,
            ]
              .join(" ")
              .toLowerCase()
              .includes(keyword);
      return matchStatus && matchKeyword;
    });
  }, [activeFilter, devices, searchValue]);

  const totalPages = Math.max(1, Math.ceil(filteredDevices.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedDevices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDevices.slice(start, start + pageSize);
  }, [currentPage, filteredDevices]);
  const selectedDeviceIdSet = useMemo(() => new Set(selectedDeviceIds), [selectedDeviceIds]);
  const selectedDevices = useMemo(() => devices.filter((device) => selectedDeviceIdSet.has(device.id)), [devices, selectedDeviceIdSet]);
  const allPageSelected = pagedDevices.length > 0 && pagedDevices.every((device) => selectedDeviceIdSet.has(device.id));
  const lifecycleBatchAction: DeviceLifecycleAction = lifecycleFilter === "disabled" ? "restore" : "disable";

  const queryDevice = initialDeviceId ? devices.find((device) => device.id === initialDeviceId) ?? null : null;
  const viewingDevice = dialogMode === "view" ? selectedDevice : queryDevice;

  const summary = useMemo(
    () => ({
      total: devices.length,
      alarm: devices.filter((device) => device.status === "报警").length,
      fault: devices.filter((device) => device.status === "故障").length,
      maintenance: devices.filter((device) => device.status === "维修中").length,
    }),
    [devices],
  );
  const deviceTableMinWidth = useMemo(() => Math.max(980, listAttributes.length * 150 + 280), [listAttributes.length]);
  const importPreviewTableMinWidth = useMemo(
    () => Math.max(860, (importPreview?.headers.length ?? 0) * 140 + 72),
    [importPreview?.headers.length],
  );

  function updateFormField(attribute: DeviceAttributeDefinition, value: string) {
    if (attribute.isCore) {
      setFormState((current) => ({ ...current, [attribute.fieldKey]: value }));
    } else {
      setFormState((current) => ({
        ...current,
        customAttributes: { ...current.customAttributes, [attribute.fieldKey]: attribute.fieldType === "number" && value !== "" ? Number(value) : value },
      }));
    }
    setFieldErrors((current) => ({ ...current, [attribute.fieldKey]: "" }));
  }

  function openCreateDialog() {
    setFormState(createEmptyDeviceForm());
    setSelectedDevice(null);
    setSubmitError("");
    setFieldErrors({});
    setDialogMode("create");
  }

  function openEditDialog(device: DeviceRecord) {
    setSelectedDevice(device);
    setFormState(toFormState(device));
    setSubmitError("");
    setFieldErrors({});
    setDialogMode("edit");
  }

  function openViewDialog(device: DeviceRecord) {
    setSelectedDevice(device);
    setDialogMode("view");
  }

  function closeDialog() {
    setDialogMode(null);
    setSelectedDevice(null);
    setSubmitError("");
    setFieldErrors({});
    setSubmitting(false);
    setAttributeError("");
    setImportError("");
    setImportProgress(0);
    setImportStatus("");
    setImportSuccess("");
    setLifecycleError("");
    setLifecyclePreview(null);
    setLifecycleReason("");
    setLifecycleProgress(0);
    setLifecycleStatus("");
    setLifecycleSuccess("");
    if (initialDeviceId) {
      router.replace("/devices");
    }
  }

  function toggleDeviceSelection(deviceId: string) {
    setSelectedDeviceIds((current) => (current.includes(deviceId) ? current.filter((id) => id !== deviceId) : [...current, deviceId]));
  }

  function togglePageSelection() {
    const pageIds = pagedDevices.map((device) => device.id);
    setSelectedDeviceIds((current) => {
      if (pageIds.every((id) => current.includes(id))) {
        return current.filter((id) => !pageIds.includes(id));
      }
      return Array.from(new Set([...current, ...pageIds]));
    });
  }

  async function previewLifecycle(action: DeviceLifecycleAction, deviceIds: string[]) {
    setLifecycleError("");
    setLifecycleSuccess("");
    setLifecyclePreview(null);
    setLifecycleStatus("正在统计影响范围...");
    setLifecycleProgress(18);
    setSubmitting(true);
    try {
      const response = await fetch("/api/tenant/devices/lifecycle/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, deviceIds }),
      });
      setLifecycleProgress(76);
      const payload = (await response.json().catch(() => null)) as (DeviceLifecyclePreview & { message?: string }) | null;
      if (!response.ok || !payload) {
        setLifecycleError(payload?.message || "影响范围统计失败");
        setLifecycleStatus("");
        setLifecycleProgress(0);
        return;
      }
      setLifecyclePreview(payload);
      setLifecycleStatus("影响范围统计完成");
      setLifecycleProgress(100);
    } catch {
      setLifecycleError("影响范围统计失败，接口未响应。");
      setLifecycleStatus("");
      setLifecycleProgress(0);
    } finally {
      setSubmitting(false);
    }
  }

  function openLifecycleDialog(action: DeviceLifecycleAction, targetDevices: DeviceRecord[]) {
    const deviceIds = targetDevices.map((device) => device.id);
    if (deviceIds.length === 0) return;
    setLifecycleAction(action);
    setLifecycleReason("");
    setLifecyclePreview(null);
    setLifecycleError("");
    setLifecycleProgress(0);
    setLifecycleStatus("");
    setLifecycleSuccess("");
    setDialogMode("lifecycle");
    void previewLifecycle(action, deviceIds);
  }

  async function commitLifecycle() {
    if (!lifecyclePreview) return;
    setSubmitting(true);
    setLifecycleError("");
    setLifecycleSuccess("");
    setLifecycleStatus(lifecycleAction === "disable" ? "正在停用设备..." : "正在恢复设备...");
    setLifecycleProgress(16);
    try {
      const response = await fetch("/api/tenant/devices/lifecycle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: lifecycleAction,
          deviceIds: lifecyclePreview.devices.map((device) => device.deviceId),
          reason: lifecycleReason,
        }),
      });
      setLifecycleProgress(72);
      const payload = (await response.json().catch(() => null)) as (DeviceLifecyclePreview & { message?: string }) | null;
      if (!response.ok || !payload) {
        setLifecycleError(payload?.message || "设备生命周期更新失败");
        setLifecycleStatus("");
        setLifecycleProgress(0);
        return;
      }
      setLifecyclePreview(payload);
      setLifecycleStatus("正在刷新设备列表...");
      setLifecycleProgress(88);
      await loadDevices();
      setSelectedDeviceIds([]);
      const updated = payload.updated ?? 0;
      const failed = payload.failed ?? 0;
      const skipped = payload.skipped ?? 0;
      const actionLabel = lifecycleAction === "disable" ? "停用" : "恢复";
      const message = `已${actionLabel} ${updated} 台，跳过 ${skipped} 台，失败 ${failed} 台`;
      setLifecycleStatus(`${actionLabel}完成`);
      setLifecycleProgress(100);
      setLifecycleSuccess(message);
      pushToast({ message, tone: failed > 0 ? "warning" : "success", duration: 4200 });
    } catch {
      setLifecycleError("设备生命周期更新失败，接口未响应。");
      setLifecycleStatus("");
      setLifecycleProgress(0);
    } finally {
      setSubmitting(false);
    }
  }

  function validateDeviceForm() {
    const nextErrors: Record<string, string> = {};
    for (const attribute of enabledAttributes) {
      if (!attribute.required) continue;
      if (!getFormFieldValue(formState, attribute).trim()) {
        nextErrors[attribute.fieldKey] = `请填写${attribute.label}`;
      }
    }
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit() {
    if (!validateDeviceForm()) {
      setSubmitError("");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    const response = await fetch("/api/tenant/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formState),
    }).catch(() => null);

    if (!response) {
      setSubmitting(false);
      setSubmitError("设备保存失败，接口未响应。请确认 web 和 backend 都已启动。");
      return;
    }

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      setSubmitting(false);
      setSubmitError(payload?.message?.trim() || `设备保存失败（HTTP ${response.status}）`);
      return;
    }

    await response.json();
    await loadDevices();
    setPage(1);
    setSubmitting(false);
    pushToast({ message: dialogMode === "create" ? "设备已创建" : "设备已更新", tone: "success" });
    closeDialog();
  }

  function openCreateAttribute() {
    setAttributeForm(createEmptyAttributeForm(Math.max(100, ...attributes.map((item) => item.sortOrder + 10))));
    setAttributeError("");
    setDialogMode("fieldForm");
  }

  function editAttribute(attribute: DeviceAttributeDefinition) {
    setAttributeForm({
      fieldKey: attribute.fieldKey,
      label: attribute.label,
      fieldType: attribute.fieldType,
      required: attribute.required,
      showInList: attribute.showInList,
      sortOrder: attribute.sortOrder,
    });
    setAttributeError("");
    setDialogMode("fieldForm");
  }

  function closeAttributeForm() {
    setAttributeError("");
    setDialogMode("fields");
  }

  async function saveAttribute() {
    if (!attributeForm.label.trim()) {
      setAttributeError("请填写字段名称");
      return;
    }

    const response = await fetch("/api/tenant/device-attributes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(attributeForm),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      setAttributeError(payload?.message || "字段保存失败");
      return;
    }

    await loadDevices();
    setAttributeForm(createEmptyAttributeForm(Math.max(100, ...attributes.map((item) => item.sortOrder + 10))));
    setDialogMode("fields");
    pushToast({ message: "设备字段已保存", tone: "success" });
  }

  async function disableAttribute(attribute: DeviceAttributeDefinition) {
    if (attribute.isCore) return;
    const result = await confirmDialog({
      title: "停用设备字段",
      description: `确认停用字段“${attribute.label}”吗？已有设备数据会保留。`,
      confirmLabel: "停用",
      tone: "warning",
    });
    if (result !== "confirm") {
      return;
    }
    const response = await fetch(`/api/tenant/device-attributes?fieldKey=${encodeURIComponent(attribute.fieldKey)}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      pushToast({ message: payload?.message || "字段停用失败", tone: "error" });
      return;
    }
    await loadDevices();
    pushToast({ message: "字段已停用，历史数据仍保留", tone: "success" });
  }

  function handleImportFileChange(file: File | null) {
    setImportFile(file);
    setImportPreview(null);
    setImportError("");
    setImportProgress(0);
    setImportStatus("");
    setImportSuccess("");
  }

  async function previewImport() {
    if (!importFile) {
      setImportError("请选择 Excel 文件");
      return;
    }
    setImportError("");
    setImportSuccess("");
    setImportStatus("正在读取 Excel 文件...");
    setImportProgress(20);
    setImportPreview(null);
    const formData = new FormData();
    formData.append("file", importFile);
    setSubmitting(true);
    try {
      const response = await fetch("/api/tenant/device-import/preview", { method: "POST", body: formData });
      setImportProgress(72);
      const payload = (await response.json().catch(() => null)) as (DeviceImportPreview & { message?: string }) | null;
      if (!response.ok || !payload) {
        setImportError(payload?.message || "导入预览失败");
        setImportStatus("");
        setImportProgress(0);
        return;
      }
      setImportPreview(payload);
      setImportStatus("预览读取完成");
      setImportProgress(100);
    } catch {
      setImportError("导入预览失败，接口未响应。请确认服务已启动。");
      setImportStatus("");
      setImportProgress(0);
    } finally {
      setSubmitting(false);
    }
  }

  async function commitImport() {
    if (!importPreview) return;
    setSubmitting(true);
    setImportError("");
    setImportSuccess("");
    setImportStatus("正在提交导入...");
    setImportProgress(12);
    try {
      const response = await fetch("/api/tenant/device-import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: importPreview.fileName,
          headers: importPreview.headers,
          rows: importPreview.rows,
          duplicatePolicy,
        }),
      });
      setImportProgress(68);
      setImportStatus("正在写入设备数据...");
      const payload = (await response.json().catch(() => null)) as (DeviceImportPreview & { message?: string }) | null;
      if (!response.ok || !payload) {
        setImportError(payload?.message || "导入失败");
        setImportStatus("");
        setImportProgress(0);
        return;
      }
      setImportPreview(payload);
      const affectedRows = (payload.created ?? 0) + (payload.updated ?? 0) + (payload.skipped ?? 0);
      if ((payload.unknownHeaders?.length ?? 0) > 0 || (payload.missingHeaders?.length ?? 0) > 0 || ((payload.errors?.length ?? 0) > 0 && affectedRows === 0)) {
        setImportError(payload.errors?.[0]?.message || "导入未完成，请先处理错误后重试。");
        setImportStatus("");
        setImportProgress(0);
        return;
      }
      setImportProgress(88);
      setImportStatus("正在刷新设备列表...");
      await loadDevices();
      const errorSuffix = payload.errors.length > 0 ? `，错误 ${payload.errors.length}` : "";
      const successMessage = `导入完成：新增 ${payload.created ?? 0}，更新 ${payload.updated ?? 0}，跳过 ${payload.skipped ?? 0}${errorSuffix}`;
      setImportProgress(100);
      setImportStatus("导入完成");
      setImportSuccess(successMessage);
      pushToast({ message: successMessage, tone: "success", duration: 4200 });
    } catch {
      setImportError("导入失败，接口未响应。请确认服务已启动。");
      setImportStatus("");
      setImportProgress(0);
    } finally {
      setSubmitting(false);
    }
  }

  function renderDeviceInput(attribute: DeviceAttributeDefinition) {
    const value = getFormFieldValue(formState, attribute);
    const error = fieldErrors[attribute.fieldKey];
    const commonLabel = requiredLabel(attribute.label, attribute.required);

    if (attribute.fieldKey === "status") {
      return (
        <label key={attribute.fieldKey} className="space-y-2">
          {commonLabel}
          <select value={formState.status} onChange={(event) => updateFormField(attribute, event.target.value)} className={fieldClassName(Boolean(error))}>
            {deviceStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (attribute.fieldKey === "installationStatus") {
      return (
        <label key={attribute.fieldKey} className="space-y-2">
          {commonLabel}
          <select
            value={formState.installationStatus}
            onChange={(event) => updateFormField(attribute, event.target.value)}
            className={fieldClassName(Boolean(error))}
          >
            {installationStatusOptions.map((status) => (
              <option key={status || "empty"} value={status}>
                {status || "未填写"}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (attribute.fieldKey === "notes") {
      return (
        <label key={attribute.fieldKey} className="space-y-2 md:col-span-2">
          {commonLabel}
          <textarea value={value} onChange={(event) => updateFormField(attribute, event.target.value)} className={`${fieldClassName(Boolean(error))} min-h-28 py-3`} />
        </label>
      );
    }

    return (
      <label key={attribute.fieldKey} className="space-y-2">
        {commonLabel}
        <input
          type={attribute.fieldType === "number" ? "number" : attribute.fieldType === "date" ? "text" : "text"}
          value={value}
          onChange={(event) => updateFormField(attribute, event.target.value)}
          className={fieldClassName(Boolean(error))}
        />
        {error ? <span className="text-xs font-medium text-[color:var(--danger-strong)]">{error}</span> : null}
      </label>
    );
  }

  return (
    <div className="space-y-2">
      <PageHeader
        title="设备管理"
        subtitle="统一维护设备台账、企业自定义属性、状态筛选、批量导入和设备停用恢复。"
        aside={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setDialogMode("fields")} className="sf-button sf-button-secondary h-9 px-3 text-sm">
              字段配置
            </button>
            <button type="button" onClick={() => setDialogMode("import")} className="sf-button sf-button-secondary h-9 px-3 text-sm">
              批量导入
            </button>
            <button type="button" onClick={openCreateDialog} className="sf-button sf-button-primary h-9 px-3 text-sm">
              新建设备
            </button>
          </div>
        }
      />

      <SectionCard title="设备总表" description="设备核心字段与企业自定义属性均会持久化，导入时以设备编码识别重复数据。" descriptionMode="tooltip">
        <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <div className="sf-kpi px-3 py-2.5">
              <p className="sf-label">设备总数</p>
              <p className="mt-1 text-xl font-semibold leading-none text-[color:var(--text-primary)]">{summary.total}</p>
            </div>
            <div className="sf-kpi px-3 py-2.5">
              <p className="sf-label text-[color:var(--danger-strong)]">报警设备</p>
              <p className="mt-1 text-xl font-semibold leading-none text-[color:var(--danger-strong)]">{summary.alarm}</p>
            </div>
            <div className="sf-kpi px-3 py-2.5">
              <p className="sf-label text-[color:var(--warning-strong)]">故障设备</p>
              <p className="mt-1 text-xl font-semibold leading-none text-[color:var(--warning-strong)]">{summary.fault}</p>
            </div>
            <div className="sf-kpi px-3 py-2.5">
              <p className="sf-label text-[color:var(--info)]">维修中</p>
              <p className="mt-1 text-xl font-semibold leading-none text-[color:var(--info)]">{summary.maintenance}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {statusFilters.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => {
                  setActiveFilter(filter);
                  setPage(1);
                }}
                className={`sf-button h-8 px-3 text-xs ${activeFilter === filter ? "sf-button-primary" : "sf-button-secondary"}`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="sf-toolbar mt-3 grid gap-2 p-2 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)_auto]">
          <input
            value={searchValue}
            onChange={(event) => {
              setSearchValue(event.target.value);
              setPage(1);
            }}
            placeholder="搜索设备编码、名称、类型、位置或自定义属性"
            className={inputClassName}
          />
          <div className="sf-metric-block flex flex-wrap items-center gap-1.5 px-3 py-2">
            <span className="sf-label mr-1">生命周期</span>
            {lifecycleFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => {
                  setLifecycleFilter(filter.value);
                  setSelectedDeviceIds([]);
                  setPage(1);
                }}
                className={`sf-button h-8 px-3 text-xs ${lifecycleFilter === filter.value ? "sf-button-primary" : "sf-button-secondary"}`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="sf-metric-block flex items-center justify-between gap-3 px-3 py-2">
            <div>
              <p className="sf-label">设备范围</p>
              <p className="mt-0.5 text-xs text-[color:var(--text-secondary)]">{loading ? "正在加载设备数据..." : "当前检索结果"}</p>
            </div>
            <p className="text-xl font-semibold leading-none text-[color:var(--text-primary)]">{loading ? "--" : filteredDevices.length}</p>
          </div>
        </div>

        {selectedDeviceIds.length > 0 ? (
          <div className="sf-toolbar mt-3 flex flex-wrap items-center justify-between gap-3 p-3">
            <div>
              <p className="text-sm font-semibold text-[color:var(--text-primary)]">已选 {selectedDeviceIds.length} 台设备</p>
              <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                {lifecycleBatchAction === "disable" ? "停用后默认不参与实时监控、首页统计和空间点位显示。" : "恢复后设备会重新出现在默认列表和原空间点位中。"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => openLifecycleDialog(lifecycleBatchAction, selectedDevices)}
              className={`sf-button h-9 px-3 text-sm ${lifecycleBatchAction === "disable" ? "sf-button-danger" : "sf-button-primary"}`}
            >
              {lifecycleBatchAction === "disable" ? "批量停用" : "批量恢复"}
            </button>
          </div>
        ) : null}

        <div className="sf-table-shell mt-3 overflow-x-auto">
          <table className="w-full table-fixed text-left text-sm" style={{ minWidth: deviceTableMinWidth }}>
            <colgroup>
              <col className="w-[48px]" />
              {listAttributes.map((attribute) => (
                <col key={attribute.fieldKey} />
              ))}
              <col className="w-[230px]" />
            </colgroup>
            <thead className="sf-table-head">
              <tr>
                <th className="px-3 py-2.5">
                  <input type="checkbox" checked={allPageSelected} disabled={pagedDevices.length === 0} onChange={togglePageSelection} aria-label="选择当前页设备" />
                </th>
                {listAttributes.map((attribute) => (
                  <th key={attribute.fieldKey} className="px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.08em]">
                    <div className="truncate" title={attribute.label}>
                      {attribute.label}
                    </div>
                  </th>
                ))}
                <th className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.08em]">操作</th>
              </tr>
            </thead>
            <tbody className="bg-[var(--table-row)]">
              {pagedDevices.map((device, index) => (
                <tr
                  key={device.id}
                  className="border-t border-[color:var(--border-soft)] text-[color:var(--text-secondary)] transition-colors duration-150 hover:bg-[color:var(--surface-muted)]"
                  style={{ backgroundColor: index % 2 === 0 ? "var(--table-row)" : "var(--table-row-alt)" }}
                >
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={selectedDeviceIdSet.has(device.id)}
                      onChange={() => toggleDeviceSelection(device.id)}
                      aria-label={`选择设备 ${device.name}`}
                    />
                  </td>
                  {listAttributes.map((attribute) => (
                    <td key={attribute.fieldKey} className="px-3 py-2.5">
                      {attribute.fieldKey === "status" ? (
                        <StatusBadge status={device.status} />
                      ) : (
                        <div className="truncate" title={getDeviceFieldValue(device, attribute)}>
                          {getDeviceFieldValue(device, attribute)}
                        </div>
                      )}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <div className="flex flex-nowrap items-center gap-1.5">
                      <button type="button" onClick={() => openViewDialog(device)} className="sf-button sf-button-secondary h-7 whitespace-nowrap px-2.5 text-xs">
                        详情
                      </button>
                      <button type="button" onClick={() => openEditDialog(device)} className="sf-button sf-button-primary h-7 whitespace-nowrap px-2.5 text-xs">
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => openLifecycleDialog(device.lifecycleStatus === "disabled" ? "restore" : "disable", [device])}
                        className={`sf-button h-7 whitespace-nowrap px-2.5 text-xs ${device.lifecycleStatus === "disabled" ? "sf-button-secondary" : "sf-button-danger"}`}
                      >
                        {device.lifecycleStatus === "disabled" ? "恢复" : "停用"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <PaginationBar page={currentPage} totalPages={totalPages} totalItems={filteredDevices.length} pageSize={pageSize} onPageChange={setPage} label="设备列表" />
      </SectionCard>

      <Dialog
        open={dialogMode === "create" || dialogMode === "edit"}
        onClose={closeDialog}
        title={dialogMode === "create" ? "新建设备" : "编辑设备"}
        description="表单字段来自当前企业的设备属性配置，自定义属性会保存到设备扩展信息。"
        footer={
          <>
            <button type="button" onClick={closeDialog} disabled={submitting} className="sf-button sf-button-secondary h-10 px-4 text-sm">
              取消
            </button>
            <button type="button" onClick={handleSubmit} disabled={submitting} className="sf-button sf-button-primary h-10 px-4 text-sm">
              保存
            </button>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          {enabledAttributes.map(renderDeviceInput)}
          {submitError ? (
            <AlertMessage tone="danger" className="md:col-span-2">
              {submitError}
            </AlertMessage>
          ) : null}
        </div>
      </Dialog>

      <Dialog
        open={(dialogMode === "view" && !!selectedDevice) || (!!initialDeviceId && !!queryDevice)}
        onClose={closeDialog}
        title="设备详情"
        description="这里显示当前设备的核心字段和启用中的企业自定义属性。"
      >
        {viewingDevice ? (
          <div className="grid gap-4 md:grid-cols-2">
            {enabledAttributes.map((attribute) => (
              <div key={attribute.fieldKey} className={`sf-metric-block p-4 ${attribute.fieldKey === "notes" ? "md:col-span-2" : ""}`}>
                <p className="sf-label">{attribute.label}</p>
                <div className="mt-2 text-base text-[color:var(--text-primary)]">
                  {attribute.fieldKey === "status" ? <StatusBadge status={viewingDevice.status} /> : getDeviceFieldValue(viewingDevice, attribute) || "未填写"}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={dialogMode === "lifecycle"}
        onClose={closeDialog}
        title={lifecycleAction === "disable" ? "停用设备" : "恢复设备"}
        description={
          lifecycleAction === "disable"
            ? "停用后设备会从默认列表、首页统计和空间点位中隐藏，历史报警、事件和维保记录会保留。"
            : "恢复后设备会重新参与默认列表、首页统计和空间点位显示。"
        }
        panelClassName="max-w-5xl"
        footer={
          <>
            <button type="button" onClick={closeDialog} disabled={submitting} className="sf-button sf-button-secondary h-10 px-4 text-sm">
              取消
            </button>
            <button
              type="button"
              onClick={commitLifecycle}
              disabled={!lifecyclePreview || lifecyclePreview.updateable === 0 || submitting}
              className={`sf-button h-10 px-4 text-sm ${lifecycleAction === "disable" ? "sf-button-danger" : "sf-button-primary"}`}
            >
              {submitting ? "处理中..." : lifecycleAction === "disable" ? "确认停用" : "确认恢复"}
            </button>
          </>
        }
      >
        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-4">
            {lifecycleProgress > 0 || lifecycleStatus || lifecycleSuccess ? (
              <div
                className={`rounded-[14px] border px-4 py-3 text-sm ${
                  lifecycleSuccess
                    ? "border-[color:var(--border-soft)] bg-[color:var(--success-soft)] text-[color:var(--success-strong)]"
                    : "border-[color:var(--border-soft)] bg-[color:var(--info-soft)] text-[color:var(--accent-strong)]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{lifecycleSuccess || lifecycleStatus}</span>
                  <span className="shrink-0 tabular-nums">{Math.round(lifecycleProgress)}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(lifecycleProgress)}
                  className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--chart-track)]"
                >
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${lifecycleSuccess ? "bg-[color:var(--success-strong)]" : "bg-[color:var(--accent-strong)]"}`}
                    style={{ width: `${Math.min(100, Math.max(4, lifecycleProgress))}%` }}
                  />
                </div>
              </div>
            ) : null}

            {lifecyclePreview ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="sf-kpi px-3 py-2.5">
                  <p className="sf-label">选中设备</p>
                  <p className="mt-1 text-xl font-semibold">{lifecyclePreview.total}</p>
                </div>
                <div className="sf-kpi px-3 py-2.5">
                  <p className="sf-label">可操作</p>
                  <p className="mt-1 text-xl font-semibold">{lifecyclePreview.updateable}</p>
                </div>
                <div className="sf-kpi px-3 py-2.5">
                  <p className="sf-label">空间点位</p>
                  <p className="mt-1 text-xl font-semibold">{lifecyclePreview.pointCount}</p>
                </div>
                <div className="sf-kpi px-3 py-2.5">
                  <p className="sf-label">未闭环报警</p>
                  <p className="mt-1 text-xl font-semibold text-[color:var(--warning-strong)]">{lifecyclePreview.openAlarmCount}</p>
                </div>
                <div className="sf-kpi px-3 py-2.5">
                  <p className="sf-label">历史事件</p>
                  <p className="mt-1 text-xl font-semibold">{lifecyclePreview.rawEventCount}</p>
                </div>
                <div className="sf-kpi px-3 py-2.5">
                  <p className="sf-label">维保记录</p>
                  <p className="mt-1 text-xl font-semibold">{lifecyclePreview.maintenanceRecordCount}</p>
                </div>
              </div>
            ) : null}

            {lifecycleAction === "disable" ? (
              <label className="space-y-2">
                <span className="text-sm text-[color:var(--text-secondary)]">停用原因</span>
                <textarea
                  value={lifecycleReason}
                  onChange={(event) => setLifecycleReason(event.target.value)}
                  className={`${inputClassName} min-h-24 py-3`}
                  placeholder="例如：设备拆除、待更换、误导入清理"
                />
              </label>
            ) : null}

            {lifecycleError ? <div className="rounded-[14px] bg-[color:var(--danger-soft)] px-4 py-3 text-sm text-[color:var(--danger-strong)]">{lifecycleError}</div> : null}
          </div>

          <div className="min-w-0 space-y-3">
            <div>
              <p className="text-sm font-semibold text-[color:var(--text-primary)]">设备明细</p>
              <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                {lifecycleAction === "disable" ? "不会删除设备点位和历史数据，只是停止实时展示与统计。" : "恢复后保留原设备编码、自定义属性和空间点位。"}
              </p>
            </div>
            <div className="sf-table-shell max-h-[52vh] overflow-auto">
              <table className="w-full min-w-[720px] table-fixed text-left text-xs">
                <colgroup>
                  <col />
                  <col className="w-[130px]" />
                  <col className="w-[90px]" />
                  <col className="w-[90px]" />
                  <col className="w-[90px]" />
                  <col className="w-[110px]" />
                </colgroup>
                <thead className="sf-table-head">
                  <tr>
                    <th className="px-3 py-2">设备</th>
                    <th className="px-3 py-2">设备编码</th>
                    <th className="px-3 py-2">空间点位</th>
                    <th className="px-3 py-2">未闭环</th>
                    <th className="px-3 py-2">状态</th>
                    <th className="px-3 py-2">结果</th>
                  </tr>
                </thead>
                <tbody>
                  {(lifecyclePreview?.devices ?? []).map((device) => (
                    <tr key={device.deviceId} className="border-t border-[color:var(--border-soft)]">
                      <td className="px-3 py-2">
                        <div className="truncate font-medium text-[color:var(--text-primary)]" title={device.name}>
                          {device.name}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="truncate" title={device.deviceCode}>
                          {device.deviceCode || "-"}
                        </div>
                      </td>
                      <td className="px-3 py-2">{device.pointCount}</td>
                      <td className="px-3 py-2">{device.openAlarmCount}</td>
                      <td className="px-3 py-2">{device.lifecycleStatus === "disabled" ? "已停用" : "启用中"}</td>
                      <td className="px-3 py-2">
                        <span className={device.canUpdate ? "text-[color:var(--success-strong)]" : "text-[color:var(--text-muted)]"}>{device.message}</span>
                      </td>
                    </tr>
                  ))}
                  {!lifecyclePreview ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-[color:var(--text-muted)]">
                        正在读取影响范围...
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={dialogMode === "fields"}
        onClose={closeDialog}
        title="设备字段配置"
        description="核心字段只能改名称、排序和列表显示；自定义字段停用后历史数据仍会保留。"
        panelClassName="max-w-5xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[color:var(--text-primary)]">当前字段</p>
              <p className="mt-1 text-xs text-[color:var(--text-muted)]">导入表头必须来自这里启用中的字段。</p>
            </div>
            <button type="button" onClick={openCreateAttribute} className="sf-button sf-button-primary h-9 px-3 text-sm">
              新增字段
            </button>
          </div>

          <div className="sf-table-shell max-h-[58vh] overflow-auto">
            <table className="w-full min-w-[760px] table-fixed text-left text-sm">
              <colgroup>
                <col />
                <col className="w-[110px]" />
                <col className="w-[90px]" />
                <col className="w-[110px]" />
                <col className="w-[120px]" />
                <col className="w-[170px]" />
              </colgroup>
              <thead className="sf-table-head">
                <tr>
                  <th className="px-3 py-2.5">字段名称</th>
                  <th className="px-3 py-2.5">类型</th>
                  <th className="px-3 py-2.5">必填</th>
                  <th className="px-3 py-2.5">列表显示</th>
                  <th className="px-3 py-2.5">属性</th>
                  <th className="whitespace-nowrap px-3 py-2.5">操作</th>
                </tr>
              </thead>
              <tbody>
                {attributes.map((attribute) => (
                  <tr key={attribute.fieldKey} className="border-t border-[color:var(--border-soft)]">
                    <td className="px-3 py-2.5 font-medium text-[color:var(--text-primary)]">
                      <div className="truncate" title={attribute.label}>
                        {attribute.label}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">{fieldTypeLabel(attribute.fieldType)}</td>
                    <td className="px-3 py-2.5">{attribute.required ? "是" : "否"}</td>
                    <td className="px-3 py-2.5">{attribute.showInList ? "是" : "否"}</td>
                    <td className="px-3 py-2.5">{attribute.isCore ? "核心字段" : attribute.enabled ? "自定义字段" : "已停用"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <div className="flex flex-nowrap items-center gap-1.5">
                        <button type="button" onClick={() => editAttribute(attribute)} className="sf-button sf-button-secondary h-7 whitespace-nowrap px-2.5 text-xs">
                          编辑
                        </button>
                        {!attribute.isCore && attribute.enabled ? (
                          <button type="button" onClick={() => disableAttribute(attribute)} className="sf-button sf-button-danger h-7 whitespace-nowrap px-2.5 text-xs">
                            停用
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={dialogMode === "fieldForm"}
        onClose={closeAttributeForm}
        title={attributeForm.fieldKey ? "编辑字段" : "新增字段"}
        description="字段名称会作为手动录入和 Excel 导入的表头名称。"
        panelClassName="max-w-xl"
        footer={
          <>
            <button type="button" onClick={closeAttributeForm} className="sf-button sf-button-secondary h-10 px-4 text-sm">
              取消
            </button>
            <button type="button" onClick={saveAttribute} className="sf-button sf-button-primary h-10 px-4 text-sm">
              保存字段
            </button>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm text-[color:var(--text-secondary)]">字段名称</span>
            <input value={attributeForm.label} onChange={(event) => setAttributeForm((current) => ({ ...current, label: event.target.value }))} className={inputClassName} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">类型</span>
            <select
              value={attributeForm.fieldType}
              disabled={Boolean(editingAttribute?.isCore)}
              onChange={(event) => setAttributeForm((current) => ({ ...current, fieldType: event.target.value as AttributeType }))}
              className={inputClassName}
            >
              <option value="auto">自动</option>
              <option value="text">文本</option>
              <option value="number">数字</option>
              <option value="date">日期</option>
              <option value="boolean">布尔</option>
            </select>
            <span className="block text-xs leading-5 text-[color:var(--text-muted)]">
              {editingAttribute?.isCore ? "核心字段类型固定，不能修改。" : "自动会按原始内容保存，适合中英文数字混合。"}
            </span>
          </label>
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">排序</span>
            <input
              type="number"
              value={attributeForm.sortOrder}
              onChange={(event) => setAttributeForm((current) => ({ ...current, sortOrder: Number(event.target.value) }))}
              className={inputClassName}
            />
          </label>
          <label className="flex h-11 items-center gap-2 text-sm text-[color:var(--text-secondary)]">
            <input
              type="checkbox"
              checked={attributeForm.required}
              disabled={Boolean(editingAttribute?.isCore)}
              onChange={(event) => setAttributeForm((current) => ({ ...current, required: event.target.checked }))}
            />
            必填
          </label>
          <label className="flex h-11 items-center gap-2 text-sm text-[color:var(--text-secondary)]">
            <input
              type="checkbox"
              checked={attributeForm.showInList}
              onChange={(event) => setAttributeForm((current) => ({ ...current, showInList: event.target.checked }))}
            />
            设备表列表显示
          </label>
          {attributeError ? (
            <div className="md:col-span-2 rounded-[14px] bg-[color:var(--danger-soft)] px-4 py-3 text-sm text-[color:var(--danger-strong)]">
              {attributeError}
            </div>
          ) : null}
        </div>
      </Dialog>

      <Dialog
        open={dialogMode === "import"}
        onClose={closeDialog}
        title="批量导入设备"
        description="上传 Excel 后会按当前企业字段配置校验表头，未配置的表头需要先到字段配置中添加。"
        panelClassName="max-w-6xl"
        footer={
          <button type="button" onClick={commitImport} disabled={!importPreview || submitting || importPreview.importableRows === 0} className="sf-button sf-button-primary h-10 px-4 text-sm">
            {submitting && importStatus.includes("导入") ? "导入中..." : "确认导入"}
          </button>
        }
      >
        <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="sf-metric-block space-y-3 p-4">
              <label className="space-y-2">
                <span className="text-sm text-[color:var(--text-secondary)]">Excel 文件</span>
                <input
                  type="file"
                  accept=".xls,.xlsx"
                  disabled={submitting}
                  onChange={(event) => handleImportFileChange(event.target.files?.[0] ?? null)}
                  className={inputClassName}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-[color:var(--text-secondary)]">重复设备</span>
                <select value={duplicatePolicy} disabled={submitting} onChange={(event) => setDuplicatePolicy(event.target.value as DuplicatePolicy)} className={inputClassName}>
                  <option value="error">重复时报错</option>
                  <option value="update">更新已存在</option>
                  <option value="skip">跳过已存在</option>
                </select>
              </label>
              <button type="button" onClick={previewImport} disabled={!importFile || submitting} className="sf-button sf-button-secondary h-10 w-full px-4 text-sm">
                {submitting && importStatus.includes("读取") ? "读取中..." : "读取预览"}
              </button>
            </div>

            {importProgress > 0 || importStatus || importSuccess ? (
              <div
                className={`rounded-[14px] border px-4 py-3 text-sm ${
                  importSuccess
                    ? "border-[color:var(--border-soft)] bg-[color:var(--success-soft)] text-[color:var(--success-strong)]"
                    : "border-[color:var(--border-soft)] bg-[color:var(--info-soft)] text-[color:var(--accent-strong)]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{importSuccess || importStatus}</span>
                  <span className="shrink-0 tabular-nums">{Math.round(importProgress)}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(importProgress)}
                  className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--chart-track)]"
                >
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${importSuccess ? "bg-[color:var(--success-strong)]" : "bg-[color:var(--accent-strong)]"}`}
                    style={{ width: `${Math.min(100, Math.max(4, importProgress))}%` }}
                  />
                </div>
              </div>
            ) : null}

            {importPreview ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="sf-kpi px-3 py-2.5">
                  <p className="sf-label">总行数</p>
                  <p className="mt-1 text-xl font-semibold">{importPreview.totalRows}</p>
                </div>
                <div className="sf-kpi px-3 py-2.5">
                  <p className="sf-label">可导入</p>
                  <p className="mt-1 text-xl font-semibold">{importPreview.importableRows}</p>
                </div>
                <div className="sf-kpi px-3 py-2.5">
                  <p className="sf-label">重复行</p>
                  <p className="mt-1 text-xl font-semibold">{importPreview.duplicateRows}</p>
                </div>
                <div className="sf-kpi px-3 py-2.5">
                  <p className="sf-label">错误</p>
                  <p className="mt-1 text-xl font-semibold">{importPreview.errors.length}</p>
                </div>
              </div>
            ) : null}

            {importError ? <div className="rounded-[14px] bg-[color:var(--danger-soft)] px-4 py-3 text-sm text-[color:var(--danger-strong)]">{importError}</div> : null}
            {importPreview && importPreview.errors.length > 0 ? (
              <div className="max-h-44 overflow-auto rounded-[14px] bg-[color:var(--danger-soft)] px-4 py-3 text-sm text-[color:var(--danger-strong)]">
                {importPreview.errors.slice(0, 10).map((error) => (
                  <p key={`${error.rowNumber}-${error.message}`}>第 {error.rowNumber} 行：{error.message}</p>
                ))}
              </div>
            ) : null}
          </div>

          {importPreview ? (
            <div className="min-w-0 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--text-primary)]">数据预览</p>
                  <p className="mt-1 text-xs text-[color:var(--text-muted)]">仅展示前 20 行，确认后会按设备编码写入。</p>
                </div>
                <p className="text-xs text-[color:var(--text-muted)]">{importPreview.fileName}</p>
              </div>
              <div className="sf-table-shell max-h-[58vh] overflow-auto">
                <table className="w-full table-fixed text-left text-xs" style={{ minWidth: importPreviewTableMinWidth }}>
                  <colgroup>
                    <col className="w-[72px]" />
                    {importPreview.headers.map((header) => (
                      <col key={header} />
                    ))}
                  </colgroup>
                  <thead className="sf-table-head">
                    <tr>
                      <th className="px-3 py-2">行号</th>
                      {importPreview.headers.map((header) => (
                        <th key={header} className="px-3 py-2">
                          <div className="truncate" title={header}>
                            {header}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.previewRows.map((row) => (
                      <tr key={row.rowNumber} className="border-t border-[color:var(--border-soft)]">
                        <td className="px-3 py-2 text-[color:var(--text-muted)]">{row.rowNumber}</td>
                        {importPreview.headers.map((header) => (
                          <td key={header} className="px-3 py-2">
                            <div className="truncate" title={row.values[header]}>
                              {row.values[header]}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[360px] items-center justify-center rounded-[16px] border border-dashed border-[color:var(--border)] bg-[var(--surface-muted)] px-6 text-center text-sm text-[color:var(--text-muted)]">
              选择 Excel 文件并读取预览后，这里会展示表头、前 20 行数据和导入校验结果。
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
