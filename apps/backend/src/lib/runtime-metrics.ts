type RuntimeErrorRecord = {
  id: string;
  source: string;
  message: string;
  detail: string;
  createdAt: string;
};

type SlidingPoint = {
  at: number;
  value: number;
};

const WINDOW_MS = 60_000;
const MAX_ERRORS = 30;
const MAX_POINTS = 300;

const ingestionHits: SlidingPoint[] = [];
const ingestionDurations: SlidingPoint[] = [];
const alarmGenerationDurations: SlidingPoint[] = [];
let notificationFailures = 0;

const runtimeErrors: RuntimeErrorRecord[] = [];

function now() {
  return Date.now();
}

function trimPoints(points: SlidingPoint[]) {
  const cutoff = now() - WINDOW_MS;
  while (points.length && points[0].at < cutoff) {
    points.shift();
  }
  while (points.length > MAX_POINTS) {
    points.shift();
  }
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function recordIngestionHit(durationMs: number) {
  ingestionHits.push({ at: now(), value: 1 });
  ingestionDurations.push({ at: now(), value: durationMs });
  trimPoints(ingestionHits);
  trimPoints(ingestionDurations);
}

export function recordAlarmGenerationSample(durationMs: number) {
  alarmGenerationDurations.push({ at: now(), value: durationMs });
  trimPoints(alarmGenerationDurations);
}

export function recordNotificationFailure(message: string, detail = "") {
  notificationFailures += 1;
  recordRuntimeError("notification", message, detail);
}

export function recordRuntimeError(source: string, message: string, detail = "") {
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

export function getRuntimeMetricsSnapshot() {
  trimPoints(ingestionHits);
  trimPoints(ingestionDurations);
  trimPoints(alarmGenerationDurations);

  const tps = ingestionHits.length / 60;
  const avgAlarmGenerationMs =
    alarmGenerationDurations.length > 0
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
