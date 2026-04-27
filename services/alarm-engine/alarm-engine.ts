import { findOpenAlarmByDevice } from "../../packages/database/src/repositories/alarms-repository";
import type { AlarmEngineContext } from "./alarm-engine-types";
import { evaluateAlarmRule } from "./alarm-rule-evaluator";

export async function runAlarmEngine(context: AlarmEngineContext) {
  const decision = evaluateAlarmRule(context);
  const activeAlarm = await findOpenAlarmByDevice(context.client, context.tenantId, context.deviceId);

  return {
    decision,
    activeAlarm,
    hasOpenAlarm: Boolean(activeAlarm),
  };
}
