"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordIngestionHit = recordIngestionHit;
exports.recordAlarmGenerationSample = recordAlarmGenerationSample;
exports.recordNotificationFailure = recordNotificationFailure;
exports.recordRuntimeError = recordRuntimeError;
exports.getRuntimeMetricsSnapshot = getRuntimeMetricsSnapshot;
const WINDOW_MS = 60000;
const MAX_ERRORS = 30;
const MAX_POINTS = 300;
const ingestionHits = [];
const ingestionDurations = [];
const alarmGenerationDurations = [];
let notificationFailures = 0;
const runtimeErrors = [];
function now() {
    return Date.now();
}
function trimPoints(points) {
    const cutoff = now() - WINDOW_MS;
    while (points.length && points[0].at < cutoff) {
        points.shift();
    }
    while (points.length > MAX_POINTS) {
        points.shift();
    }
}
function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function recordIngestionHit(durationMs) {
    ingestionHits.push({ at: now(), value: 1 });
    ingestionDurations.push({ at: now(), value: durationMs });
    trimPoints(ingestionHits);
    trimPoints(ingestionDurations);
}
function recordAlarmGenerationSample(durationMs) {
    alarmGenerationDurations.push({ at: now(), value: durationMs });
    trimPoints(alarmGenerationDurations);
}
function recordNotificationFailure(message, detail = "") {
    notificationFailures += 1;
    recordRuntimeError("notification", message, detail);
}
function recordRuntimeError(source, message, detail = "") {
    runtimeErrors.unshift({
        id: createId("runtime"),
        source,
        message,
        detail,
        createdAt: new Date().toISOString(),
    });
    while (runtimeErrors.length > MAX_ERRORS) {
        runtimeErrors.pop();
    }
}
function getRuntimeMetricsSnapshot() {
    trimPoints(ingestionHits);
    trimPoints(ingestionDurations);
    trimPoints(alarmGenerationDurations);
    const tps = ingestionHits.length / 60;
    const avgAlarmGenerationMs = alarmGenerationDurations.length > 0
        ? alarmGenerationDurations.reduce((sum, item) => sum + item.value, 0) / alarmGenerationDurations.length
        : ingestionDurations.length > 0
            ? ingestionDurations.reduce((sum, item) => sum + item.value, 0) / ingestionDurations.length
            : 0;
    return {
        ingestionTps: Number(tps.toFixed(2)),
        avgAlarmGenerationMs: Math.round(avgAlarmGenerationMs),
        notificationFailures,
        recentErrors: [...runtimeErrors],
    };
}
