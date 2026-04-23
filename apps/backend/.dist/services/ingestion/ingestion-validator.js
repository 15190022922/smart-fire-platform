"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateIngestionEventInput = validateIngestionEventInput;
const ingestion_types_1 = require("./ingestion-types");
const allowedEventTypes = new Set(ingestion_types_1.ingestionEventTypes);
function isObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function validateIngestionEventInput(input) {
    if (!isObject(input)) {
        return { success: false, message: "请求体必须为 JSON 对象" };
    }
    const tenant_id = String(input.tenant_id ?? "").trim();
    const device_id = String(input.device_id ?? "").trim();
    const event_type = String(input.event_type ?? "").trim();
    const event_time = String(input.event_time ?? "").trim();
    const event_value = input.event_value;
    if (!tenant_id)
        return { success: false, message: "tenant_id 必填" };
    if (!device_id)
        return { success: false, message: "device_id 必填" };
    if (!allowedEventTypes.has(event_type)) {
        return { success: false, message: "event_type 非法，必须为 alarm / fault / offline / recovery / heartbeat" };
    }
    if (!event_time)
        return { success: false, message: "event_time 必填" };
    if (Number.isNaN(new Date(event_time).getTime())) {
        return { success: false, message: "event_time 必须为合法 ISO 时间字符串" };
    }
    if (typeof event_value !== "string" &&
        typeof event_value !== "number" &&
        !isObject(event_value)) {
        return { success: false, message: "event_value 必须为 string、number 或 object" };
    }
    return {
        success: true,
        data: {
            tenant_id,
            device_id,
            event_type: event_type,
            event_value: event_value,
            event_time,
        },
    };
}
