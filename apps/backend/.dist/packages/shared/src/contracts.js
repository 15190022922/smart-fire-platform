"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deviceRuntimeStatuses = exports.alarmWorkflowStatuses = exports.realtimeEventTypes = void 0;
exports.realtimeEventTypes = [
    "alarm_created",
    "alarm_updated",
    "device_status_changed",
    "system_alert",
    "heartbeat",
];
exports.alarmWorkflowStatuses = ["未处理", "已确认", "处理中", "已完成", "已关闭"];
exports.deviceRuntimeStatuses = ["normal", "alarm", "fault", "offline", "maintenance"];
