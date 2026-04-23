import {
  createInspectionTask,
  getDutyCenterData,
  getInspectionCenterData,
  handoverDutySchedule,
  submitInspectionRecord,
  updateIssueStatus,
} from "../../../lib/db";

export const dutyRepository = {
  getCenterData: getDutyCenterData,
  handover: handoverDutySchedule,
};

export const inspectionRepository = {
  getCenterData: getInspectionCenterData,
  createTask: createInspectionTask,
  submitRecord: submitInspectionRecord,
  updateIssue: updateIssueStatus,
};
