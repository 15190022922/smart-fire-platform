"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeLegacyStatusText = normalizeLegacyStatusText;
exports.normalizeLegacyText = normalizeLegacyText;
exports.normalizeDeviceStatusText = normalizeDeviceStatusText;
exports.normalizeProcessStatusText = normalizeProcessStatusText;
exports.normalizeWorkflowStatusText = normalizeWorkflowStatusText;
exports.normalizeLegacyAlarmTypeText = normalizeLegacyAlarmTypeText;
exports.resolveRuntimeStatusFromAlarmTypeText = resolveRuntimeStatusFromAlarmTypeText;
const legacyStatusTextMap = {
    "\u6fee\u6fd3\u7d7d\u9416\u003f": "正常",
    "\u59dd\uff45\u7236": "正常",
    "\u95b9\u8eb1\u5134\u9852\u003f": "报警",
    "\u95b9\u8eb2\u5134\u9852\u003f": "报警",
    "\u93b6\u30e8\ue11f": "报警",
    "\u95ba\u4f78\u61d8\u5a08\u003f": "故障",
    "\u93c1\u5474\u6bb0": "故障",
    "\u7f01\u509d\u5d35\u9364\u003f": "离线",
    "\u7ec2\u8364\u568e": "离线",
    "\u7f02\u4f7a\u7e5d\u93b1\u3126\u7a09\u003f": "维修中",
    "\u935a\ue21c\u6564": "启用",
    "\u95b8\u6c3c\u57b3\u93c1\u003f": "启用",
    "\u934b\u6ec5\u6564": "停用",
    "\u95b8\u5b2b\u7c8e\u93c1\u003f": "停用",
    "\u93c8\ue044\ue629\u941e\u003f": "未处理",
    "\u95ba\u582b\u4e9c\u9866\u2545\u60b6\u003f": "未处理",
    "\u5a62\u8dfa\u5aee\u93ae\u5a43\u7a09\u003f": "处理中",
    "\u6fe0\u3223\u6cdb\u701a\ue1c0\u5e43\u6fe0\u51aa\u2594\u003f": "处理中",
    "\u5bb8\u63d2\ue629\u941e\u003f": "已处理",
    "\u7039\u544a\u5f43\u9866\u2545\u60b6\u003f": "已处理",
    "\u93c8\ue045\u66a3\u93c0\u003f": "未整改",
    "\u93c1\u5b58\u657c\u6d93\u003f": "整改中",
    "\u5bb8\u53c9\u66a3\u93c0\u003f": "已整改",
    "\u5bb8\u63d2\ue632\u93cc\u003f": "已复查",
    "\u7487\u66e0\u6564\u6d93\u003f": "试用中",
    "\u9420\u56e8\u6d1c\u93c1\u3086\u7a09\u003f": "试用中",
    "\u5bb8\u832c\u6553\u93c1\u003f": "已生效",
    "\u7039\u6b4c\u5c19\u93c1\u64bb\u5f2b\u003f": "已生效",
    "\u5bb8\u8336\u7e43\u93c8\u003f": "已过期",
    "\u7039\u6b4c\u5c2a\u7efb\u51ae\u5f35\u003f": "已过期",
    "\u5bb8\u63d2\u4ee0\u9422\u003f": "已停用",
    "\u7039\u544a\u5f43\u6d60\u72bb\u60bd\u003f": "已停用",
    "\u93b6\u30e8\ue11f\u6dc7\u2103\u4f05": "报警信息",
    "\u95b9\u8eb1\u5134\u9852\u71b8\u7a71\u9229\u51a7\u7d16": "报警信息",
    "\u95b9\u8eb2\u5134\u9852\u71b8\u7a71\u9229\u51a7\u7d16": "报警信息",
    "\u93c1\u5474\u6bb0\u6dc7\u2103\u4f05": "故障信息",
    "\u95ba\u4f78\u61d8\u5a08\u7248\u7a71\u9229\u51a7\u7d16": "故障信息",
    "\u9369\u8679\ue505\u9473\u85c9\u59cf": "基础能力",
    "\u6fa7\u70b2\u20ac\u8270\u5158\u9354\u003f": "增值能力",
};
const legacyAlarmTypeTokens = {
    fire: ["\u940f\ue0a5\ue11f", "火警"],
    fault: ["\u93c1\u5474\u6bb0", "故障"],
    offline: ["\u7ec2\u8364\u568e", "离线"],
    recovery: ["\u93ad\u3220\ue632", "恢复"],
    heartbeat: ["\u8e47\u51ad\u70e6", "心跳"],
};
function includesAny(text, tokens) {
    return tokens.some((token) => text.includes(token));
}
function normalizeLegacyStatusText(value) {
    const text = String(value ?? "");
    return legacyStatusTextMap[text] ?? text;
}
function normalizeLegacyText(value) {
    let text = String(value ?? "");
    for (const [legacyValue, normalizedValue] of Object.entries(legacyStatusTextMap)) {
        text = text.split(legacyValue).join(normalizedValue);
    }
    return text;
}
function normalizeDeviceStatusText(value) {
    const normalized = normalizeLegacyStatusText(value);
    if (normalized === "报警" || normalized === "故障" || normalized === "离线" || normalized === "维修中") {
        return normalized;
    }
    return "正常";
}
function normalizeProcessStatusText(value) {
    const normalized = normalizeLegacyStatusText(value);
    if (normalized === "处理中")
        return "处理中";
    if (normalized === "已处理" || normalized === "已完成" || normalized === "已关闭")
        return "已处理";
    return "未处理";
}
function normalizeWorkflowStatusText(value) {
    const normalized = normalizeLegacyStatusText(value);
    if (normalized === "已确认")
        return "已确认";
    if (normalized === "处理中")
        return "处理中";
    if (normalized === "已处理" || normalized === "已完成")
        return "已完成";
    if (normalized === "已关闭")
        return "已关闭";
    return "未处理";
}
function normalizeLegacyAlarmTypeText(value) {
    const text = String(value ?? "");
    if (includesAny(text, legacyAlarmTypeTokens.fire))
        return "火警报警";
    if (includesAny(text, legacyAlarmTypeTokens.fault))
        return "设备故障";
    if (includesAny(text, legacyAlarmTypeTokens.offline))
        return "设备离线";
    if (includesAny(text, legacyAlarmTypeTokens.recovery))
        return "设备恢复";
    if (includesAny(text, legacyAlarmTypeTokens.heartbeat))
        return "设备心跳";
    return text;
}
function resolveRuntimeStatusFromAlarmTypeText(alarmType) {
    const normalized = normalizeLegacyAlarmTypeText(alarmType);
    if (normalized.includes("火警") || normalized.includes("报警") || normalized.includes("alarm"))
        return "alarm";
    if (normalized.includes("故障") || normalized.includes("fault"))
        return "fault";
    if (normalized.includes("离线") || normalized.includes("offline"))
        return "offline";
    return "normal";
}
