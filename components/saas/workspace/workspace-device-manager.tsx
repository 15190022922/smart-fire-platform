"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { FeatureGuard } from "@/components/saas/feature-guard";
import { useSaaSDemo } from "@/components/saas/saas-demo-provider";
import { StatusBadge } from "@/components/status-badge";
import { ActionButton } from "@/components/ui/action-button";
import { DataTable, DataTableCell, DataTableHead, DataTableHeaderCell, DataTableRow, DataTableShell } from "@/components/ui/data-table";
import { fieldClassName } from "@/components/ui/form-controls";
import { DeviceStatus, TenantDeviceRecord } from "@/types/saas";

const inputClassName = fieldClassName;

type DeviceFormState = Omit<TenantDeviceRecord, "id" | "tenantId">;

const deviceStatuses: DeviceStatus[] = ["正常", "报警", "故障", "离线", "维修中"];

export function WorkspaceDeviceManager() {
  const { currentTenant, currentTenantDevices, setTenantDevices, hasPermission } = useSaaSDemo();
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<TenantDeviceRecord | null>(null);
  const [formState, setFormState] = useState<DeviceFormState>({
    deviceCode: "",
    name: "",
    type: "",
    area: "",
    location: "",
    status: "正常",
    installationStatus: "已安装",
    lastReportAt: "2026-04-20 09:00:00",
    customAttributes: {},
  });

  const canManage = hasPermission("tenant.devices.manage");

  function openCreate() {
    setSelectedDevice(null);
    setDialogMode("create");
  }

  function openEdit(device: TenantDeviceRecord) {
    setSelectedDevice(device);
    setFormState({
      deviceCode: device.deviceCode ?? "",
      name: device.name,
      type: device.type,
      area: device.area,
      location: device.location,
      status: device.status,
      installationStatus: device.installationStatus ?? "已安装",
      lastReportAt: device.lastReportAt,
      customAttributes: device.customAttributes ?? {},
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
              <ActionButton onClick={openCreate}>
                新增设备
              </ActionButton>
            ) : null
          }
        />
        <SectionCard title="设备列表" description="二级及以上企业角色可编辑设备，三级用户默认只读。">
          <DataTableShell>
            <DataTable>
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell>设备名称</DataTableHeaderCell>
                  <DataTableHeaderCell>设备类型</DataTableHeaderCell>
                  <DataTableHeaderCell>区域</DataTableHeaderCell>
                  <DataTableHeaderCell>位置</DataTableHeaderCell>
                  <DataTableHeaderCell>状态</DataTableHeaderCell>
                  <DataTableHeaderCell>最近上报时间</DataTableHeaderCell>
                  {canManage ? <DataTableHeaderCell>操作</DataTableHeaderCell> : null}
                </tr>
              </DataTableHead>
              <tbody>
                {currentTenantDevices.map((device, index) => (
                  <DataTableRow key={device.id} stripedIndex={index}>
                    <DataTableCell className="font-medium text-[color:var(--text-primary)]">{device.name}</DataTableCell>
                    <DataTableCell>{device.type}</DataTableCell>
                    <DataTableCell>{device.area}</DataTableCell>
                    <DataTableCell>{device.location}</DataTableCell>
                    <DataTableCell><StatusBadge status={device.status} /></DataTableCell>
                    <DataTableCell>{device.lastReportAt}</DataTableCell>
                    {canManage ? (
                      <DataTableCell>
                        <ActionButton onClick={() => openEdit(device)} size="xs" variant="primary">
                          编辑
                        </ActionButton>
                      </DataTableCell>
                    ) : null}
                  </DataTableRow>
                ))}
              </tbody>
            </DataTable>
          </DataTableShell>
        </SectionCard>
      </div>

      <Dialog
        open={dialogMode === "create" || dialogMode === "edit"}
        onClose={closeDialog}
        title={dialogMode === "create" ? "新增设备" : "编辑设备"}
        footer={
          <>
            <ActionButton onClick={closeDialog}>取消</ActionButton>
            <ActionButton onClick={saveDevice} variant="primary">保存</ActionButton>
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
