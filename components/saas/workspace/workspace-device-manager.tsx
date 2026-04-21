"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { FeatureGuard } from "@/components/saas/feature-guard";
import { useSaaSDemo } from "@/components/saas/saas-demo-provider";
import { StatusBadge } from "@/components/status-badge";
import { DeviceStatus, TenantDeviceRecord } from "@/types/saas";

const inputClassName =
  "w-full rounded-2xl border border-[color:var(--field-border)] bg-[var(--field-bg)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100";

type DeviceFormState = Omit<TenantDeviceRecord, "id" | "tenantId">;

const deviceStatuses: DeviceStatus[] = ["正常", "报警", "故障", "离线", "维修中"];

export function WorkspaceDeviceManager() {
  const { currentTenant, currentTenantDevices, setTenantDevices, hasPermission } = useSaaSDemo();
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<TenantDeviceRecord | null>(null);
  const [formState, setFormState] = useState<DeviceFormState>({
    name: "",
    type: "",
    area: "",
    location: "",
    status: "正常",
    lastReportAt: "2026-04-20 09:00:00",
  });

  const canManage = hasPermission("tenant.devices.manage");

  function openCreate() {
    setSelectedDevice(null);
    setDialogMode("create");
  }

  function openEdit(device: TenantDeviceRecord) {
    setSelectedDevice(device);
    setFormState({
      name: device.name,
      type: device.type,
      area: device.area,
      location: device.location,
      status: device.status,
      lastReportAt: device.lastReportAt,
    });
    setDialogMode("edit");
  }

  function closeDialog() {
    setDialogMode(null);
    setSelectedDevice(null);
  }

  function saveDevice() {
    if (!currentTenant) {
      return;
    }

    if (dialogMode === "create") {
      setTenantDevices((current) => [
        {
          id: `tenant-device-${Date.now()}`,
          tenantId: currentTenant.id,
          ...formState,
        },
        ...current,
      ]);
    }

    if (dialogMode === "edit" && selectedDevice) {
      setTenantDevices((current) =>
        current.map((item) => (item.id === selectedDevice.id ? { ...selectedDevice, ...formState } : item)),
      );
    }

    closeDialog();
  }

  return (
    <FeatureGuard title="设备管理" featureKey="device_management" permissionKey="tenant.devices.view">
      <div className="space-y-6">
        <PageHeader
          title="设备管理"
          subtitle="设备数据严格按 tenant_id 过滤，当前只显示本企业设备。"
          aside={
            canManage ? (
              <button type="button" onClick={openCreate} className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-700">
                新增设备
              </button>
            ) : null
          }
        />
        <SectionCard title="设备列表" description="二级及以上企业角色可编辑设备，三级用户默认只读。">
          <div className="overflow-x-auto rounded-[24px] border border-[color:var(--border)]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--table-head)] text-[color:var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">设备名称</th>
                  <th className="px-4 py-3 font-medium">设备类型</th>
                  <th className="px-4 py-3 font-medium">区域</th>
                  <th className="px-4 py-3 font-medium">位置</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">最近上报时间</th>
                  {canManage ? <th className="px-4 py-3 font-medium">操作</th> : null}
                </tr>
              </thead>
              <tbody>
                {currentTenantDevices.map((device, index) => (
                  <tr key={device.id} className="border-t border-[color:var(--border)]" style={{ backgroundColor: index % 2 === 0 ? "var(--table-row)" : "var(--table-row-alt)" }}>
                    <td className="px-4 py-4 font-medium text-[color:var(--text-primary)]">{device.name}</td>
                    <td className="px-4 py-4 text-[color:var(--text-secondary)]">{device.type}</td>
                    <td className="px-4 py-4 text-[color:var(--text-secondary)]">{device.area}</td>
                    <td className="px-4 py-4 text-[color:var(--text-secondary)]">{device.location}</td>
                    <td className="px-4 py-4"><StatusBadge status={device.status} /></td>
                    <td className="px-4 py-4 text-[color:var(--text-secondary)]">{device.lastReportAt}</td>
                    {canManage ? (
                      <td className="px-4 py-4">
                        <button type="button" onClick={() => openEdit(device)} className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs text-sky-700">
                          编辑
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      <Dialog
        open={dialogMode === "create" || dialogMode === "edit"}
        onClose={closeDialog}
        title={dialogMode === "create" ? "新增设备" : "编辑设备"}
        footer={
          <>
            <button type="button" onClick={closeDialog} className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--text-secondary)]">取消</button>
            <button type="button" onClick={saveDevice} className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-700">保存</button>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ["设备名称", "name"],
            ["设备类型", "type"],
            ["所属区域", "area"],
            ["安装位置", "location"],
            ["最近上报时间", "lastReportAt"],
          ].map(([label, key]) => (
            <label key={key} className="space-y-2">
              <span className="text-sm text-[color:var(--text-secondary)]">{label}</span>
              <input
                value={formState[key as keyof DeviceFormState] as string}
                onChange={(event) => setFormState((current) => ({ ...current, [key]: event.target.value }))}
                className={inputClassName}
              />
            </label>
          ))}
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-secondary)]">设备状态</span>
            <select value={formState.status} onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value as DeviceStatus }))} className={inputClassName}>
              {deviceStatuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
        </div>
      </Dialog>
    </FeatureGuard>
  );
}
