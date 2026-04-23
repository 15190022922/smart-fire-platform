export type InspectionTaskRecord = {
  id: string;
  tenantId: string;
  title: string;
  planType: "daily" | "weekly";
  targetType: "device" | "area";
  targetId: string;
  targetName: string;
  dueDate: string;
  assignedTo: string;
  status: "pending" | "in_progress" | "completed" | "abnormal";
  note: string;
  createdAt: string;
};

export type InspectionRecord = {
  id: string;
  tenantId: string;
  taskId: string;
  result: "completed" | "abnormal";
  note: string;
  inspectedBy: string;
  inspectedAt: string;
};

export type IssueRecord = {
  id: string;
  tenantId: string;
  sourceType: "inspection" | "device" | "manual";
  sourceId: string;
  title: string;
  level: "low" | "medium" | "high";
  status: "未整改" | "整改中" | "已整改" | "已复查";
  note: string;
  rectificationDeadline?: string;
  rectifiedAt?: string;
  reviewedAt?: string;
  createdAt: string;
};

export type MaintenanceRecord = {
  id: string;
  tenantId: string;
  deviceId: string;
  deviceName: string;
  vendorName: string;
  maintenanceDate: string;
  nextDueDate: string;
  result: string;
  note: string;
};

export type InspectionCenterPayload = {
  generatedAt: string;
  tasks: InspectionTaskRecord[];
  records: InspectionRecord[];
  issues: IssueRecord[];
  maintenanceRecords: MaintenanceRecord[];
};
