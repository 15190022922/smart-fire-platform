export type DutyShiftRecord = {
  id: string;
  tenantId: string;
  name: string;
  startTime: string;
  endTime: string;
  isDefault: boolean;
};

export type DutyScheduleRecord = {
  id: string;
  tenantId: string;
  dutyDate: string;
  shiftId: string;
  shiftName: string;
  shiftStartTime: string;
  shiftEndTime: string;
  assigneeName: string;
  assigneePhone: string;
  assignedBy: string;
  status: "scheduled" | "active" | "handover" | "closed";
  startedAt?: string;
  endedAt?: string;
  handoverNote: string;
};

export type DutyLogRecord = {
  id: string;
  tenantId: string;
  scheduleId?: string;
  logType: "login" | "alarm_action" | "handover" | "exception" | "shift_action";
  content: string;
  operatorName: string;
  createdAt: string;
};

export type DutyCenterPayload = {
  generatedAt: string;
  shifts: DutyShiftRecord[];
  schedules: DutyScheduleRecord[];
  currentSchedule?: DutyScheduleRecord;
  openAlarmCount: number;
  dutyLogs: DutyLogRecord[];
};
