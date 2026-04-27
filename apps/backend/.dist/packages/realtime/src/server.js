"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscribeTenantEvents = subscribeTenantEvents;
exports.publishTenantEvent = publishTenantEvent;
exports.getRealtimeServerStats = getRealtimeServerStats;
const tenantSubscribers = new Map();
let publishFailureCount = 0;
function nextSubscriberId() {
    return `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function nextEventId() {
    return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function parseOccurredAt(value) {
    const text = String(value ?? "").trim();
    return text || new Date().toISOString();
}
function toDate(value) {
    const normalized = value.replace(" ", "T");
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}
function inferRealtimeType(payload) {
    const explicit = payload.type;
    if (explicit === "alarm_created" ||
        explicit === "alarm_updated" ||
        explicit === "device_status_changed" ||
        explicit === "system_alert" ||
        explicit === "heartbeat") {
        return explicit;
    }
    const eventType = String(payload.eventType ?? "");
    const eventCode = String(payload.eventCode ?? "");
    if (eventType === "alarm" || eventType === "fault" || eventCode === "DEVICE_OFFLINE")
        return "alarm_created";
    if (eventType === "alarm_workflow_updated" || eventType === "alarm_status_changed" || eventType === "recovery") {
        return "alarm_updated";
    }
    if (eventType === "heartbeat")
        return "heartbeat";
    return "device_status_changed";
}
function toEnvelope(tenantId, payload) {
    const occurredAt = parseOccurredAt(payload.occurredAt ?? payload.reportedAt);
    const serverTime = new Date().toISOString();
    const latencyMs = Math.max(0, new Date(serverTime).getTime() - toDate(occurredAt).getTime());
    return {
        eventId: String(payload.eventId ?? nextEventId()),
        tenantId,
        type: inferRealtimeType(payload),
        occurredAt,
        serverTime,
        latencyMs,
        payload,
    };
}
function subscribeTenantEvents(tenantId, push) {
    const subscriber = { id: nextSubscriberId(), push };
    const bucket = tenantSubscribers.get(tenantId) ?? new Map();
    bucket.set(subscriber.id, subscriber);
    tenantSubscribers.set(tenantId, bucket);
    return () => {
        const current = tenantSubscribers.get(tenantId);
        if (!current)
            return;
        current.delete(subscriber.id);
        if (current.size === 0) {
            tenantSubscribers.delete(tenantId);
        }
    };
}
function publishTenantEvent(tenantId, payload) {
    const bucket = tenantSubscribers.get(tenantId);
    if (!bucket || bucket.size === 0)
        return;
    const serialized = JSON.stringify(toEnvelope(tenantId, payload));
    for (const subscriber of bucket.values()) {
        try {
            subscriber.push(serialized);
        }
        catch {
            publishFailureCount += 1;
        }
    }
}
function getRealtimeServerStats() {
    let connectionCount = 0;
    for (const bucket of tenantSubscribers.values()) {
        connectionCount += bucket.size;
    }
    return {
        connectionCount,
        publishFailureCount,
    };
}
