"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAlarmEngine = runAlarmEngine;
const alarm_rule_evaluator_1 = require("./alarm-rule-evaluator");
async function runAlarmEngine(context) {
    const decision = (0, alarm_rule_evaluator_1.evaluateAlarmRule)(context);
    const openAlarms = await context.client.query(`
      SELECT id, alarm_type, workflow_status, process_status
      FROM tenant_alarms
      WHERE tenant_id = $1
        AND device_id = $2
        AND workflow_status NOT IN ('已完成', '已关闭')
      ORDER BY time DESC
    `, [context.tenantId, context.deviceId]);
    const activeAlarm = openAlarms.rows[0] ?? null;
    return {
        decision,
        activeAlarm,
        hasOpenAlarm: Boolean(activeAlarm),
    };
}
