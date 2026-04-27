"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Dialog } from "@/components/ui/dialog";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { getTenantEventBus } from "@/lib/realtime/event-bus";

type DeviceStatus = "正常" | "报警" | "故障" | "离线" | "维修中";
type DeviceStatusFilter = DeviceStatus | "全部";

type DeviceRecord = {
  id: string;
  name: string;
  type: string;
  area: string;
  installationLocation: string;
  location: string;
  status: DeviceStatus;
  lastReportAt: string;
  notes: string;
};

type DeviceFormState = {
  id?: string;
  name: string;
  type: string;
  area: string;
  installationLocation: string;
  status: DeviceStatus;
  lastReportAt: string;
  notes: string;
};

const statusFilters: DeviceStatusFilter[] = ["全部", "正常", "报警", "故障", "离线", "维修中"];
const deviceStatuses: DeviceStatus[] = ["正常", "报警", "故障", "离线", "维修中"];
const pageSize = 6;

const inputClassName =
  "sf-input h-11 px-4 text-sm";

const emptyDeviceForm: DeviceFormState = {
  name: "",
  type: "",
  area: "",
  installationLocation: "",
  status: "正常",
  lastReportAt: "2026-04-20 09:00:00",
  notes: "",
};

function toFormState(device: DeviceRecord): DeviceFormState {
  return {
    id: device.id,
    name: device.name,
    type: device.type,
    area: device.area,
    installationLocation: device.installationLocation,
    status: device.status,
    lastReportAt: device.lastReportAt,
    notes: device.notes,
  };
}

export function DeviceManager({ initialDeviceId }: { initialDeviceId?: string }) {
  const router = useRouter();
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchValue, setSearchValue] = useState("");
  const [activeFilter, setActiveFilter] = useState<DeviceStatusFilter>("全部");
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view" | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<DeviceRecord | null>(null);
  const [formState, setFormState] = useState<DeviceFormState>(emptyDeviceForm);
  const [page, setPage] = useState(1);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadDevices = useCallback(async () => {
    const response = await fetch("/api/tenant/devices", { cache: "no-store" });
    if (!response.ok) {
      setLoading(false);
      return;
    }
    const result = (await response.json()) as { devices: DeviceRecord[] };
    setDevices(result.devices ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const response = await fetch("/api/tenant/devices", { cache: "no-store" });
      if (!response.ok) {
        if (active) {
          setLoading(false);
        }
        return;
      }
      const result = (await response.json()) as { devices: DeviceRecord[] };
      if (active) {
        setDevices(result.devices ?? []);
        setLoading(false);
      }
    }

    void bootstrap();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const bus = getTenantEventBus();
    return bus.subscribe({
      types: ["alarm_created", "alarm_updated", "device_status_changed", "system_alert"],
      onEvent: () => {
        void loadDevices();
      },
    });
  }, [loadDevices]);

  const filteredDevices = useMemo(() => {
    return devices.filter((device) => {
      const matchStatus = activeFilter === "全部" ? true : device.status === activeFilter;
      const keyword = searchValue.trim().toLowerCase();
      const matchKeyword =
        keyword.length === 0
          ? true
          : [device.name, device.type, device.area, device.installationLocation, device.status]
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

  function openCreateDialog() {
    setFormState(emptyDeviceForm);
    setSelectedDevice(null);
    setSubmitError("");
    setDialogMode("create");
  }

  function openEditDialog(device: DeviceRecord) {
    setSelectedDevice(device);
    setFormState(toFormState(device));
    setSubmitError("");
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
    setSubmitting(false);
    if (initialDeviceId) {
      router.replace("/devices");
    }
  }

  async function handleSubmit() {
    if (!formState.name || !formState.type || !formState.area || !formState.installationLocation) {
      setSubmitError("设备名称、设备类型、所属区域和安装位置不能为空。");
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
      setSubmitError(payload?.message ?? "设备保存失败，请稍后重试。");
      return;
    }

    const result = (await response.json()) as { device: DeviceRecord };
    if (dialogMode === "create") {
      setDevices((current) => [result.device, ...current]);
      setPage(1);
    } else if (dialogMode === "edit" && selectedDevice) {
      setDevices((current) =>
        current.map((device) => (device.id === selectedDevice.id ? result.device : device)),
      );
    }

    setSubmitting(false);
    closeDialog();
  }

  async function handleDelete(device: DeviceRecord) {
    if (!window.confirm(`确认删除设备“${device.name}”吗？`)) {
      return;
    }

    const response = await fetch(`/api/tenant/devices?id=${device.id}`, { method: "DELETE" });
    if (!response.ok) {
      return;
    }

    setDevices((current) => current.filter((item) => item.id !== device.id));
  }

  return (
    <div className="space-y-2.5">
      <PageHeader
        title="设备管理"
        subtitle="统一维护设备台账、状态筛选和详情查看，列表与地图点位使用同一份设备数据。"
        aside={
          <button type="button" onClick={openCreateDialog} className="sf-button sf-button-primary h-10 px-4 text-sm">
            新增设备
          </button>
        }
      />

      <SectionCard
        title="设备总表"
        description="当前设备列表与增删改查已接入持久化存储，刷新页面或重新登录后会保留。"
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="sf-kpi px-4 py-4">
              <p className="sf-label">设备总数</p>
              <p className="mt-3 text-2xl font-semibold leading-none tracking-[-0.03em] text-[color:var(--text-primary)]">{summary.total}</p>
            </div>
            <div className="sf-kpi px-4 py-4" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, var(--danger-soft) 180%)" }}>
              <p className="sf-label text-[color:var(--danger-strong)]">报警设备</p>
              <p className="mt-3 text-2xl font-semibold leading-none tracking-[-0.03em] text-[color:var(--danger-strong)]">{summary.alarm}</p>
            </div>
            <div className="sf-kpi px-4 py-4" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, var(--warning-soft) 180%)" }}>
              <p className="sf-label text-[color:var(--warning-strong)]">故障设备</p>
              <p className="mt-3 text-2xl font-semibold leading-none tracking-[-0.03em] text-[color:var(--warning-strong)]">{summary.fault}</p>
            </div>
            <div className="sf-kpi px-4 py-4" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, var(--info-soft) 180%)" }}>
              <p className="sf-label text-[color:var(--info)]">维修中</p>
              <p className="mt-3 text-2xl font-semibold leading-none tracking-[-0.03em] text-[color:var(--info)]">{summary.maintenance}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {statusFilters.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => {
                  setActiveFilter(filter);
                  setPage(1);
                }}
                className={`sf-button h-10 px-4 text-sm ${activeFilter === filter ? "sf-button-primary" : "sf-button-secondary"}`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="sf-toolbar mt-5 grid gap-3 p-3 xl:grid-cols-[minmax(0,320px)_1fr]">
          <input
            value={searchValue}
            onChange={(event) => {
              setSearchValue(event.target.value);
              setPage(1);
            }}
            placeholder="搜索设备名称、类型、区域或状态"
            className={inputClassName}
          />
          <div className="sf-metric-block flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="sf-label">Device Scope</p>
              <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                {loading ? "正在加载设备数据..." : "当前检索结果"}
              </p>
            </div>
            <p className="text-2xl font-semibold leading-none tracking-[-0.03em] text-[color:var(--text-primary)]">
              {loading ? "--" : filteredDevices.length}
            </p>
          </div>
        </div>

        <div className="sf-table-shell mt-5 overflow-x-auto">
          <table className="min-w-[760px] text-left text-sm">
            <thead className="sf-table-head">
              <tr>
                <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.08em]">设备名称</th>
                <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.08em]">设备类型</th>
                <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.08em]">所在位置</th>
                <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.08em]">当前状态</th>
                <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.08em]">最近上报时间</th>
                <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.08em]">操作</th>
              </tr>
            </thead>
            <tbody className="bg-[var(--table-row)]">
              {pagedDevices.map((device, index) => (
                <tr
                  key={device.id}
                  className="border-t border-[color:var(--border-soft)] text-[color:var(--text-secondary)] transition-colors duration-150 hover:bg-[color:var(--surface-muted)]"
                  style={{
                    backgroundColor: index % 2 === 0 ? "var(--table-row)" : "var(--table-row-alt)",
                  }}
                >
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-semibold tracking-[-0.01em] text-[color:var(--text-primary)]">{device.name}</p>
                      <p className="mt-1 text-xs text-[color:var(--text-muted)]">{device.area}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4">{device.type}</td>
                  <td className="px-4 py-4">
                    <div className="max-w-56">
                      <p className="truncate text-[color:var(--text-primary)]">{device.location}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={device.status} />
                  </td>
                  <td className="px-4 py-4">{device.lastReportAt}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openViewDialog(device)}
                        className="sf-button sf-button-secondary h-8 px-3 text-xs"
                      >
                        详情
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditDialog(device)}
                        className="sf-button sf-button-primary h-8 px-3 text-xs"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(device)}
                        className="sf-button sf-button-danger h-8 px-3 text-xs"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <PaginationBar
          page={currentPage}
          totalPages={totalPages}
          totalItems={filteredDevices.length}
          pageSize={pageSize}
          onPageChange={setPage}
          label="设备列表"
        />
      </SectionCard>

      <Dialog
        open={dialogMode === "create" || dialogMode === "edit"}
        onClose={closeDialog}
        title={dialogMode === "create" ? "新增设备" : "编辑设备"}
        description="设备修改会直接写入本地数据库。"
        footer={
          <>
            <button
              type="button"
              onClick={closeDialog}
              disabled={submitting}
              className="sf-button sf-button-secondary h-10 px-4 text-sm"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="sf-button sf-button-primary h-10 px-4 text-sm"
            >
              保存
            </button>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">设备名称</span>
            <input value={formState.name} onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} className={inputClassName} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">设备类型</span>
            <input value={formState.type} onChange={(event) => setFormState((current) => ({ ...current, type: event.target.value }))} className={inputClassName} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">所属区域/楼层</span>
            <input value={formState.area} onChange={(event) => setFormState((current) => ({ ...current, area: event.target.value }))} className={inputClassName} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">安装位置</span>
            <input value={formState.installationLocation} onChange={(event) => setFormState((current) => ({ ...current, installationLocation: event.target.value }))} className={inputClassName} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">设备状态</span>
            <select value={formState.status} onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value as DeviceStatus }))} className={inputClassName}>
              {deviceStatuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">最近上报时间</span>
            <input value={formState.lastReportAt} onChange={(event) => setFormState((current) => ({ ...current, lastReportAt: event.target.value }))} className={inputClassName} />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm text-[color:var(--text-secondary)]">备注</span>
            <textarea value={formState.notes} onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))} className={`${inputClassName} min-h-28 py-3`} />
          </label>
          {submitError ? (
            <div className="md:col-span-2 rounded-[14px] border border-[color:rgba(176,72,79,0.18)] bg-[color:var(--danger-soft)] px-4 py-3 text-sm text-[color:var(--danger-strong)]">
              {submitError}
            </div>
          ) : null}
        </div>
      </Dialog>

      <Dialog
        open={(dialogMode === "view" && !!selectedDevice) || (!!initialDeviceId && !!queryDevice)}
        onClose={closeDialog}
        title="设备详情"
        description="点击地图点位或列表详情时会显示当前设备的最新数据库记录。"
      >
        {viewingDevice ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="sf-metric-block p-4">
              <p className="sf-label">设备名称</p>
              <p className="mt-2 text-base font-semibold text-[color:var(--text-primary)]">{viewingDevice.name}</p>
            </div>
            <div className="sf-metric-block p-4">
              <p className="sf-label">设备状态</p>
              <div className="mt-2">
                <StatusBadge status={viewingDevice.status} />
              </div>
            </div>
            <div className="sf-metric-block p-4">
              <p className="sf-label">设备类型</p>
              <p className="mt-2 text-base text-[color:var(--text-primary)]">{viewingDevice.type}</p>
            </div>
            <div className="sf-metric-block p-4">
              <p className="sf-label">最近上报时间</p>
              <p className="mt-2 text-base text-[color:var(--text-primary)]">{viewingDevice.lastReportAt}</p>
            </div>
            <div className="sf-metric-block p-4 md:col-span-2">
              <p className="sf-label">所在位置</p>
              <p className="mt-2 text-base text-[color:var(--text-primary)]">{viewingDevice.location}</p>
            </div>
            <div className="sf-metric-block p-4 md:col-span-2">
              <p className="sf-label">备注</p>
              <p className="mt-2 text-base leading-7 text-[color:var(--text-primary)]">{viewingDevice.notes}</p>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
