"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateAlarmRule = evaluateAlarmRule;
function evaluateAlarmRule(context) {
    if (context.eventType === "alarm") {
        return {
            nextDeviceStatus: "alarm",
            shouldCreateAlarm: true,
            shouldCreateNotification: true,
            shouldPublishRealtimeType: "alarm_created",
            alarmTypeLabel: "火警报警",
            alarmLogAction: "报警触发",
            eventCode: "FIRE_ALARM",
        };
    }
    if (context.eventType === "fault") {
        return {
            nextDeviceStatus: "fault",
            shouldCreateAlarm: true,
            shouldCreateNotification: true,
            shouldPublishRealtimeType: "alarm_created",
            alarmTypeLabel: "设备故障",
            alarmLogAction: "故障触发",
            eventCode: "DEVICE_FAULT",
        };
    }
    if (context.eventType === "offline") {
        return {
            nextDeviceStatus: "offline",
            shouldCreateAlarm: false,
            shouldCreateNotification: false,
            shouldPublishRealtimeType: "device_status_changed",
            alarmTypeLabel: "设备离线",
            alarmLogAction: "离线记录",
            eventCode: "DEVICE_OFFLINE",
        };
    }
    if (context.eventType === "recovery") {
        return {
            nextDeviceStatus: "normal",
            shouldCreateAlarm: false,
            shouldCreateNotification: false,
            shouldPublishRealtimeType: "alarm_updated",
            alarmTypeLabel: "设备恢复",
            alarmLogAction: "恢复记录",
            eventCode: "DEVICE_RECOVER",
        };
    }
    return {
        nextDeviceStatus: "normal",
        shouldCreateAlarm: false,
        shouldCreateNotification: false,
        shouldPublishRealtimeType: "heartbeat",
        alarmTypeLabel: "设备心跳",
        alarmLogAction: "心跳更新",
        eventCode: "HEARTBEAT_OK",
    };
}
