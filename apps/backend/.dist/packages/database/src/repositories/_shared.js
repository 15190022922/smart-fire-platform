"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ISSUE_STATUS_REVIEWED = exports.ISSUE_STATUS_RESOLVED = exports.ISSUE_STATUS_IN_PROGRESS = exports.ISSUE_STATUS_PENDING = exports.DUTY_STATUS_HANDOVER = exports.DUTY_STATUS_SCHEDULED = exports.DUTY_STATUS_ACTIVE = exports.ALARM_PROCESS_RESOLVED = exports.ALARM_WORKFLOW_CLOSED = exports.ALARM_WORKFLOW_COMPLETED = exports.ALARM_WORKFLOW_PROCESSING = exports.ALARM_WORKFLOW_CONFIRMED = exports.ALARM_WORKFLOW_PENDING = void 0;
exports.formatDateParts = formatDateParts;
exports.formatLocalTimestamp = formatLocalTimestamp;
exports.formatLocalDate = formatLocalDate;
exports.parseDbDate = parseDbDate;
exports.createId = createId;
exports.fromJsonArray = fromJsonArray;
exports.jsonStringArray = jsonStringArray;
exports.normalizeStatusText = normalizeStatusText;
exports.normalizeWorkflowStatus = normalizeWorkflowStatus;
exports.normalizeAlarmTypeText = normalizeAlarmTypeText;
exports.mapTenantDevice = mapTenantDevice;
exports.mapTenantUser = mapTenantUser;
exports.mapPlatformUser = mapPlatformUser;
exports.mapAlarm = mapAlarm;
exports.mapAlarmTimeline = mapAlarmTimeline;
exports.mapAlarmCenterItem = mapAlarmCenterItem;
exports.mapNotificationTemplate = mapNotificationTemplate;
exports.mapNotificationRecord = mapNotificationRecord;
exports.mapTenant = mapTenant;
exports.mapPlan = mapPlan;
exports.mapSubscription = mapSubscription;
exports.mapNotificationSetting = mapNotificationSetting;
exports.mapQuota = mapQuota;
exports.mapAuditLog = mapAuditLog;
exports.mapDutyShift = mapDutyShift;
exports.mapDutySchedule = mapDutySchedule;
exports.mapDutyLog = mapDutyLog;
exports.mapInspectionTask = mapInspectionTask;
exports.mapInspectionRecord = mapInspectionRecord;
exports.mapIssue = mapIssue;
exports.mapMaintenanceRecord = mapMaintenanceRecord;
exports.mapSite = mapSite;
exports.mapBuilding = mapBuilding;
exports.mapFloor = mapFloor;
exports.mapDrawing = mapDrawing;
exports.mapGateway = mapGateway;
exports.mapDevicePoint = mapDevicePoint;
exports.mapRawDeviceEvent = mapRawDeviceEvent;
exports.mapDeviceStatusSnapshot = mapDeviceStatusSnapshot;
exports.mapRuntimeStatus = mapRuntimeStatus;
exports.resolveRuntimeStatusFromAlarmType = resolveRuntimeStatusFromAlarmType;
exports.buildSystemHealthMetric = buildSystemHealthMetric;
exports.buildSystemHealthPayload = buildSystemHealthPayload;
/* eslint-disable @typescript-eslint/no-explicit-any */
const contracts_1 = require("../../../shared/src/contracts");
exports.ALARM_WORKFLOW_PENDING = contracts_1.alarmWorkflowStatuses[0];
exports.ALARM_WORKFLOW_CONFIRMED = contracts_1.alarmWorkflowStatuses[1];
exports.ALARM_WORKFLOW_PROCESSING = contracts_1.alarmWorkflowStatuses[2];
exports.ALARM_WORKFLOW_COMPLETED = contracts_1.alarmWorkflowStatuses[3];
exports.ALARM_WORKFLOW_CLOSED = contracts_1.alarmWorkflowStatuses[4];
exports.ALARM_PROCESS_RESOLVED = "宸插鐞?";
exports.DUTY_STATUS_ACTIVE = "active";
exports.DUTY_STATUS_SCHEDULED = "scheduled";
exports.DUTY_STATUS_HANDOVER = "handover";
exports.ISSUE_STATUS_PENDING = "鏈暣鏀?";
exports.ISSUE_STATUS_IN_PROGRESS = "鏁存敼涓?";
exports.ISSUE_STATUS_RESOLVED = "宸叉暣鏀?";
exports.ISSUE_STATUS_REVIEWED = "宸插鏌?";
function formatDateParts(date, timeZone = "Asia/Shanghai") {
    const formatter = new Intl.DateTimeFormat("sv-SE", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
    return Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
}
function formatLocalTimestamp(date = new Date(), timeZone = "Asia/Shanghai") {
    const parts = formatDateParts(date, timeZone);
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}
function formatLocalDate(date = new Date(), timeZone = "Asia/Shanghai") {
    const parts = formatDateParts(date, timeZone);
    return `${parts.year}-${parts.month}-${parts.day}`;
}
function parseDbDate(value) {
    const normalized = String(value ?? "").trim().replace("T", " ");
    const [datePart, timePart = "00:00:00"] = normalized.split(" ");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute, second] = timePart.split(":").map(Number);
    return new Date(year || 1970, (month || 1) - 1, day || 1, hour || 0, minute || 0, second || 0);
}
function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function fromJsonArray(raw) {
    if (Array.isArray(raw))
        return raw.map((item) => String(item));
    if (typeof raw === "string") {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
        }
        catch {
            return [];
        }
    }
    return [];
}
function jsonStringArray(raw) {
    return fromJsonArray(raw);
}
function normalizeStatusText(value) {
    const text = String(value ?? "");
    const map = {
        "濮濓絽鐖?": "正常",
        "閹躲儴顒?": "报警",
        "閺佸懘娈?": "故障",
        "缁傝崵鍤?": "离线",
        "缂佺繝鎱ㄦ稉?": "维修中",
        "閸氼垳鏁?": "启用",
        "閸嬫粎鏁?": "停用",
        "閺堫亜顦╅悶?": "未处理",
        "婢跺嫮鎮婃稉?": "处理中",
        "瀹告彃顦╅悶?": "已处理",
        "鐠囨洜鏁ゆ稉?": "试用中",
        "瀹歌尙鏁撻弫?": "已生效",
        "瀹歌尪绻冮張?": "已过期",
        "瀹告彃浠犻悽?": "已停用",
        "閹躲儴顒熸穱鈩冧紖": "报警信息",
        "閺佸懘娈版穱鈩冧紖": "故障信息",
    };
    return map[text] ?? text;
}
function normalizeWorkflowStatus(value) {
    const normalized = normalizeStatusText(String(value ?? ""));
    if (normalized === "已处理")
        return "已完成";
    return normalized;
}
function normalizeAlarmTypeText(value) {
    const text = String(value ?? "");
    if (text.includes("鐏") || text.includes("火警"))
        return "火警报警";
    if (text.includes("鏁呴殰") || text.includes("故障"))
        return "设备故障";
    if (text.includes("绂荤嚎") || text.includes("离线"))
        return "设备离线";
    if (text.includes("鎭㈠") || text.includes("恢复"))
        return "设备恢复";
    if (text.includes("蹇冭烦") || text.includes("心跳"))
        return "设备心跳";
    return text;
}
function mapTenantDevice(row) {
    return {
        id: row.id,
        tenantId: row.tenant_id,
        name: row.name,
        type: row.type,
        area: row.area,
        location: row.installation_location,
        installationLocation: row.installation_location,
        status: normalizeStatusText(row.status),
        lastReportAt: row.last_report_at,
        notes: row.notes,
        siteId: row.site_id ?? undefined,
        buildingId: row.building_id ?? undefined,
        floorId: row.floor_id ?? undefined,
        gatewayId: row.gateway_id ?? undefined,
        modelCode: row.model_code ?? "",
        protocolType: row.protocol_type ?? "",
        serialNumber: row.serial_number ?? "",
    };
}
function mapTenantUser(row) {
    return {
        id: row.id,
        tenantId: row.tenant_id,
        username: row.username,
        phone: row.phone,
        roleKey: row.role_key,
        status: normalizeStatusText(row.status),
        smsEnabled: Boolean(row.sms_enabled),
        messageTypes: fromJsonArray(row.message_types).map((item) => normalizeStatusText(item)),
        note: row.note,
    };
}
function mapPlatformUser(row) {
    return {
        id: row.id,
        username: row.username,
        phone: row.phone,
        roleKey: row.role_key,
        status: normalizeStatusText(row.status),
        note: row.note,
    };
}
function mapAlarm(row) {
    return {
        id: row.id,
        tenantId: row.tenant_id,
        deviceId: row.device_id,
        deviceName: row.device_name,
        location: row.location,
        alarmType: normalizeAlarmTypeText(row.alarm_type),
        time: row.time,
        processStatus: normalizeStatusText(row.process_status),
    };
}
function mapAlarmTimeline(row) {
    return {
        id: row.id,
        action: row.action,
        fromStatus: normalizeWorkflowStatus(row.from_status),
        toStatus: normalizeWorkflowStatus(row.to_status),
        operatorName: row.operator_name,
        operatorRole: row.operator_role,
        note: row.note,
        attachments: jsonStringArray(row.attachments),
        createdAt: row.created_at,
    };
}
function mapAlarmCenterItem(row, timelines) {
    return {
        id: row.id,
        tenantId: row.tenant_id,
        deviceId: row.device_id,
        deviceName: row.device_name,
        location: row.location,
        alarmType: normalizeAlarmTypeText(row.alarm_type),
        time: row.time,
        processStatus: normalizeStatusText(row.process_status),
        workflowStatus: normalizeWorkflowStatus(row.workflow_status),
        falseAlarm: Boolean(row.false_alarm),
        detailNote: row.detail_note,
        attachments: jsonStringArray(row.attachments),
        assignedUserName: row.assigned_user_name,
        lastOperatorName: row.last_operator_name,
        acknowledgedAt: row.acknowledged_at ?? undefined,
        processingAt: row.processing_at ?? undefined,
        completedAt: row.completed_at ?? undefined,
        closedAt: row.closed_at ?? undefined,
        closedReason: row.closed_reason,
        timeline: timelines.filter((item) => item.alarm_id === row.id).map(mapAlarmTimeline),
    };
}
function mapNotificationTemplate(row) {
    return {
        id: row.id,
        tenantId: row.tenant_id,
        name: row.name,
        channel: row.channel,
        level: row.level,
        targetRoles: jsonStringArray(row.target_roles),
        templateText: row.template_text,
        enabled: Boolean(row.enabled),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function mapNotificationRecord(row) {
    return {
        id: row.id,
        tenantId: row.tenant_id,
        alarmId: row.alarm_id ?? undefined,
        templateId: row.template_id ?? undefined,
        channel: row.channel,
        level: row.level,
        targetName: row.target_name,
        content: row.content,
        status: row.status,
        retryCount: Number(row.retry_count),
        lastError: row.last_error,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function mapTenant(row) {
    return {
        id: row.id,
        name: row.name,
        code: row.code,
        industry: row.industry,
        contactName: row.contact_name,
        contactPhone: row.contact_phone,
        status: row.status,
        createdAt: row.created_at,
        note: row.note,
    };
}
function mapPlan(row) {
    return {
        id: row.id,
        name: row.name,
        code: row.code,
        status: row.status,
        priceMonthly: Number(row.price_monthly),
        maxDevices: Number(row.max_devices),
        maxUsers: Number(row.max_users),
        smsQuota: Number(row.sms_quota),
        featureKeys: fromJsonArray(row.feature_keys),
        description: row.description,
    };
}
function mapSubscription(row) {
    return {
        id: row.id,
        tenantId: row.tenant_id,
        planId: row.plan_id,
        status: normalizeStatusText(row.status),
        startDate: row.start_date,
        endDate: row.end_date,
        trial: Boolean(row.trial),
        autoRenew: Boolean(row.auto_renew),
    };
}
function mapNotificationSetting(row) {
    return {
        id: row.id,
        tenantId: row.tenant_id,
        alarmThreshold: row.alarm_threshold,
        notificationEnabled: Boolean(row.notification_enabled),
        mapPlaceholder: row.map_placeholder,
        remark: row.remark,
    };
}
function mapQuota(row) {
    return {
        id: row.id,
        tenantId: row.tenant_id,
        deviceCount: Number(row.device_count),
        userCount: Number(row.user_count),
        smsUsed: Number(row.sms_used),
    };
}
function mapAuditLog(row) {
    return {
        id: row.id,
        tenantId: row.tenant_id ?? undefined,
        actorScope: row.actor_scope,
        actorName: row.actor_name,
        actorRole: row.actor_role,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        result: row.result,
        detail: row.detail,
        createdAt: row.created_at,
    };
}
function mapDutyShift(row) {
    return {
        id: row.id,
        tenantId: row.tenant_id,
        name: row.name,
        startTime: row.start_time,
        endTime: row.end_time,
        isDefault: Boolean(row.is_default),
    };
}
function mapDutySchedule(row, shifts) {
    const shift = shifts.find((item) => item.id === row.shift_id);
    return {
        id: row.id,
        tenantId: row.tenant_id,
        dutyDate: row.duty_date,
        shiftId: row.shift_id,
        shiftName: shift?.name ?? row.shift_id,
        shiftStartTime: shift?.startTime ?? "",
        shiftEndTime: shift?.endTime ?? "",
        assigneeName: row.assignee_name,
        assigneePhone: row.assignee_phone,
        assignedBy: row.assigned_by,
        status: row.status,
        startedAt: row.started_at ?? undefined,
        endedAt: row.ended_at ?? undefined,
        handoverNote: row.handover_note ?? "",
    };
}
function mapDutyLog(row) {
    return {
        id: row.id,
        tenantId: row.tenant_id,
        scheduleId: row.schedule_id ?? undefined,
        logType: row.log_type,
        content: row.content,
        operatorName: row.operator_name,
        createdAt: row.created_at,
    };
}
function mapInspectionTask(row) {
    return {
        id: row.id,
        tenantId: row.tenant_id,
        title: row.title,
        planType: row.plan_type,
        targetType: row.target_type,
        targetId: row.target_id,
        targetName: row.target_name,
        dueDate: row.due_date,
        assignedTo: row.assigned_to,
        status: row.status,
        note: row.note,
        createdAt: row.created_at,
    };
}
function mapInspectionRecord(row) {
    return {
        id: row.id,
        tenantId: row.tenant_id,
        taskId: row.task_id,
        result: row.result,
        note: row.note,
        inspectedBy: row.inspected_by,
        inspectedAt: row.inspected_at,
    };
}
function mapIssue(row) {
    return {
        id: row.id,
        tenantId: row.tenant_id,
        sourceType: row.source_type,
        sourceId: row.source_id,
        title: row.title,
        level: row.level,
        status: row.status,
        note: row.note,
        rectificationDeadline: row.rectification_deadline ?? undefined,
        rectifiedAt: row.rectified_at ?? undefined,
        reviewedAt: row.reviewed_at ?? undefined,
        createdAt: row.created_at,
    };
}
function mapMaintenanceRecord(row) {
    return {
        id: row.id,
        tenantId: row.tenant_id,
        deviceId: row.device_id,
        deviceName: row.device_name,
        vendorName: row.vendor_name,
        maintenanceDate: row.maintenance_date,
        nextDueDate: row.next_due_date,
        result: row.result,
        note: row.note,
    };
}
function mapSite(row) {
    return {
        id: row.id,
        tenantId: row.tenant_id,
        name: row.name,
        code: row.code,
        address: row.address,
        status: row.status,
        description: row.description,
    };
}
function mapBuilding(row) {
    return {
        id: row.id,
        tenantId: row.tenant_id,
        siteId: row.site_id,
        name: row.name,
        code: row.code,
        levelCount: Number(row.level_count),
        usageType: row.usage_type,
    };
}
function mapFloor(row) {
    return {
        id: row.id,
        tenantId: row.tenant_id,
        buildingId: row.building_id,
        name: row.name,
        code: row.code,
        levelIndex: Number(row.level_index),
        description: row.description,
    };
}
function mapDrawing(row) {
    return {
        id: row.id,
        tenantId: row.tenant_id,
        floorId: row.floor_id,
        name: row.name,
        fileUrl: row.file_url,
        width: Number(row.width),
        height: Number(row.height),
        version: row.version,
        status: row.status,
        updatedAt: row.updated_at,
    };
}
function mapGateway(row) {
    return {
        id: row.id,
        tenantId: row.tenant_id,
        siteId: row.site_id,
        name: row.name,
        protocol: row.protocol,
        serialNumber: row.serial_number,
        status: row.status,
        lastSeenAt: row.last_seen_at,
    };
}
function mapDevicePoint(row) {
    return {
        id: row.id,
        tenantId: row.tenant_id,
        deviceId: row.device_id,
        floorId: row.floor_id,
        drawingId: row.drawing_id,
        x: Number(row.x),
        y: Number(row.y),
        rotation: Number(row.rotation),
        icon: row.icon,
        statusStyle: row.status_style,
        updatedAt: row.updated_at,
    };
}
function mapRawDeviceEvent(row) {
    const rawPayload = row.payload;
    const payload = rawPayload && typeof rawPayload === "object" ? rawPayload : {};
    return {
        id: row.id,
        tenantId: row.tenant_id,
        deviceId: row.device_id,
        gatewayId: row.gateway_id ?? undefined,
        eventType: row.event_type,
        eventCode: row.event_code,
        eventLevel: row.event_level,
        payload,
        reportedAt: row.reported_at,
    };
}
function mapDeviceStatusSnapshot(row) {
    return {
        deviceId: row.device_id,
        tenantId: row.tenant_id,
        gatewayId: row.gateway_id ?? undefined,
        status: row.status,
        lastEventType: row.last_event_type,
        lastEventCode: row.last_event_code,
        lastReportedAt: row.last_reported_at,
        updatedAt: row.updated_at,
    };
}
function mapRuntimeStatus(runtimeStatus) {
    return {
        runtimeStatus,
        deviceStatusText: runtimeStatus === "alarm"
            ? "报警"
            : runtimeStatus === "fault"
                ? "故障"
                : runtimeStatus === "offline"
                    ? "离线"
                    : runtimeStatus === "maintenance"
                        ? "维修中"
                        : "正常",
        pointStatusStyle: runtimeStatus === "alarm"
            ? "alarm"
            : runtimeStatus === "fault"
                ? "fault"
                : runtimeStatus === "offline"
                    ? "offline"
                    : "normal",
    };
}
function resolveRuntimeStatusFromAlarmType(alarmType) {
    if (alarmType.includes("鐏") || alarmType.includes("火警") || alarmType.includes("报警"))
        return "alarm";
    if (alarmType.includes("鏁呴殰") || alarmType.includes("故障"))
        return "fault";
    if (alarmType.includes("绂荤嚎") || alarmType.includes("离线"))
        return "offline";
    return "normal";
}
function buildSystemHealthMetric(input) {
    return input;
}
function buildSystemHealthPayload(input) {
    return input;
}
