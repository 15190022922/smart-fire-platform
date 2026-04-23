import type { AlarmEngineContext } from "@/services/alarm-engine/alarm-engine-types";
import { evaluateAlarmRule } from "@/services/alarm-engine/alarm-rule-evaluator";

type OpenAlarmRow = {
  id: string;
  alarm_type: string;
  workflow_status: string;
  process_status: string;
};

export async function runAlarmEngine(context: AlarmEngineContext) {
  const decision = evaluateAlarmRule(context);

  const openAlarms = await context.client.query<OpenAlarmRow>(
    `
      SELECT id, alarm_type, workflow_status, process_status
      FROM tenant_alarms
      WHERE tenant_id = $1
        AND device_id = $2
        AND workflow_status NOT IN ('已完成', '已关闭')
      ORDER BY time DESC
    `,
    [context.tenantId, context.deviceId],
  );

  const activeAlarm = openAlarms.rows[0] ?? null;

  return {
    decision,
    activeAlarm,
    hasOpenAlarm: Boolean(activeAlarm),
  };
}
