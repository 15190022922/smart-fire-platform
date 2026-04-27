const baseUrl = process.env.SMART_FIRE_BACKEND_BASE_URL || "http://127.0.0.1:4001";
const tenantId = process.env.SMART_FIRE_TENANT_ID || "tenant-huaxing";
const devicePrefix = process.env.SMART_FIRE_DEVICE_PREFIX || "device-hx";
const scenario = process.env.SCENARIO || "single-device";
const total = Number(process.env.TOTAL_EVENTS || 100);
const concurrency = Number(process.env.CONCURRENCY || 10);

function buildEvent(index) {
  const eventTime = new Date().toISOString();

  if (scenario === "heartbeat-storm") {
    return {
      tenant_id: tenantId,
      device_id: `${devicePrefix}-${(index % 3) + 1}`,
      event_id: `pressure-heartbeat-${index}`,
      event_type: "heartbeat",
      event_value: { latency: index % 50 },
      event_time: eventTime,
    };
  }

  if (scenario === "duplicate-event") {
    return {
      tenant_id: tenantId,
      device_id: `${devicePrefix}-1`,
      event_id: "pressure-duplicate-key",
      event_type: "alarm",
      event_value: { smoke: 88 },
      event_time: eventTime,
    };
  }

  if (scenario === "multi-device") {
    return {
      tenant_id: tenantId,
      device_id: `${devicePrefix}-${(index % 3) + 1}`,
      event_id: `pressure-multi-${index}`,
      event_type: index % 2 === 0 ? "alarm" : "fault",
      event_value: { seq: index },
      event_time: eventTime,
    };
  }

  return {
    tenant_id: tenantId,
    device_id: `${devicePrefix}-1`,
    event_id: `pressure-single-${index}`,
    event_type: "alarm",
    event_value: { seq: index, smoke: 80 + (index % 20) },
    event_time: eventTime,
  };
}

async function sendEvent(index) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}/api/ingestion/event`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-scope": "platform",
      "x-tenant-id": tenantId,
      "x-user-name": encodeURIComponent("pressure_tester"),
      "x-user-role": "platform_super_admin",
    },
    body: JSON.stringify(buildEvent(index)),
  });
  const endedAt = performance.now();
  return {
    ok: response.ok,
    status: response.status,
    durationMs: Math.round(endedAt - startedAt),
  };
}

async function main() {
  const queue = Array.from({ length: total }, (_, index) => index);
  const results = [];

  async function worker() {
    while (queue.length > 0) {
      const index = queue.shift();
      if (index === undefined) return;
      results.push(await sendEvent(index));
    }
  }

  const startedAt = Date.now();
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const elapsedMs = Date.now() - startedAt;

  const successCount = results.filter((item) => item.ok).length;
  const failureCount = results.length - successCount;
  const avgMs = results.length > 0 ? Math.round(results.reduce((sum, item) => sum + item.durationMs, 0) / results.length) : 0;

  console.log(
    JSON.stringify(
      {
        scenario,
        total,
        concurrency,
        successCount,
        failureCount,
        elapsedMs,
        tps: Number((results.length / Math.max(elapsedMs / 1000, 1)).toFixed(2)),
        avgMs,
        maxMs: Math.max(...results.map((item) => item.durationMs), 0),
        statuses: [...new Set(results.map((item) => item.status))],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
