"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAlarmEngine = runAlarmEngine;
const alarms_repository_1 = require("../../packages/database/src/repositories/alarms-repository");
const alarm_rule_evaluator_1 = require("./alarm-rule-evaluator");
async function runAlarmEngine(context) {
    const decision = (0, alarm_rule_evaluator_1.evaluateAlarmRule)(context);
    const activeAlarm = await (0, alarms_repository_1.findOpenAlarmByDevice)(context.client, context.tenantId, context.deviceId);
    return {
        decision,
        activeAlarm,
        hasOpenAlarm: Boolean(activeAlarm),
    };
}
