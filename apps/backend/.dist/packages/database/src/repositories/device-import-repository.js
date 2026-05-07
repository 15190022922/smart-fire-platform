"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.previewTenantDeviceImport = previewTenantDeviceImport;
exports.commitTenantDeviceImport = commitTenantDeviceImport;
const errors_1 = require("../errors");
const _shared_1 = require("./_shared");
const device_attributes_repository_1 = require("./device-attributes-repository");
const devices_repository_1 = require("./devices-repository");
const deviceStatuses = new Set(["正常", "报警", "故障", "离线", "维修中"]);
function normalizeHeader(value) {
    return String(value ?? "").trim();
}
function normalizeCell(value) {
    if (value === null || value === undefined)
        return "";
    return String(value).trim();
}
function getDefinitionByKey(definitions, fieldKey) {
    return definitions.find((definition) => definition.fieldKey === fieldKey);
}
function buildLabelMap(definitions) {
    return new Map(definitions.filter((item) => item.enabled).map((item) => [item.label, item]));
}
async function loadExistingDeviceCodes(executor, tenantId, codes) {
    if (codes.length === 0)
        return new Map();
    const result = await executor.query("SELECT device_code, id FROM tenant_devices WHERE tenant_id = $1 AND device_code = ANY($2::text[])", [tenantId, codes]);
    return new Map(result.rows.map((row) => [String(row.device_code), String(row.id)]));
}
async function loadExistingCustomAttributes(executor, tenantId, ids) {
    if (ids.length === 0)
        return new Map();
    const result = await executor.query("SELECT id, custom_attributes FROM tenant_devices WHERE tenant_id = $1 AND id = ANY($2::text[])", [
        tenantId,
        ids,
    ]);
    return new Map(result.rows.map((row) => [
        String(row.id),
        row.custom_attributes && typeof row.custom_attributes === "object"
            ? row.custom_attributes
            : {},
    ]));
}
async function previewTenantDeviceImport(executor, tenantId, input) {
    (0, errors_1.assertTenantId)(tenantId);
    const definitions = await (0, device_attributes_repository_1.listTenantDeviceAttributesWithDefaults)(executor, tenantId);
    const enabledDefinitions = definitions.filter((item) => item.enabled);
    const labelMap = buildLabelMap(enabledDefinitions);
    const headers = Array.from(new Set((input.headers ?? []).map(normalizeHeader).filter(Boolean)));
    const rows = (input.rows ?? []).map((row) => ({
        rowNumber: Number(row.rowNumber),
        values: Object.fromEntries(Object.entries(row.values ?? {}).map(([key, value]) => [normalizeHeader(key), normalizeCell(value)])),
    }));
    const previewRows = rows.slice(0, 20);
    const unknownHeaders = headers.filter((header) => !labelMap.has(header));
    const deviceCodeDefinition = getDefinitionByKey(enabledDefinitions, "deviceCode");
    const missingHeaders = deviceCodeDefinition && !headers.includes(deviceCodeDefinition.label) ? [deviceCodeDefinition.label] : [];
    const errors = [];
    if (unknownHeaders.length > 0) {
        errors.push({ rowNumber: 1, message: `存在未配置表头：${unknownHeaders.join("、")}` });
    }
    if (missingHeaders.length > 0) {
        errors.push({ rowNumber: 1, message: `缺少设备编码表头：${missingHeaders.join("、")}` });
    }
    const codeLabel = deviceCodeDefinition?.label ?? "设备编码";
    const seenCodes = new Map();
    const validCodes = [];
    for (const row of rows) {
        const deviceCode = normalizeCell(row.values[codeLabel]);
        if (!deviceCode) {
            errors.push({ rowNumber: row.rowNumber, message: "设备编码不能为空" });
            continue;
        }
        const firstRow = seenCodes.get(deviceCode);
        if (firstRow) {
            errors.push({ rowNumber: row.rowNumber, message: `设备编码 ${deviceCode} 在第 ${firstRow} 行已出现` });
            continue;
        }
        seenCodes.set(deviceCode, row.rowNumber);
        validCodes.push(deviceCode);
    }
    const existingCodes = await loadExistingDeviceCodes(executor, tenantId, validCodes);
    const invalidRows = new Set(errors.filter((error) => error.rowNumber > 1).map((error) => error.rowNumber));
    return {
        fileName: input.fileName ?? "",
        headers,
        rows,
        previewRows,
        totalRows: rows.length,
        importableRows: unknownHeaders.length > 0 || missingHeaders.length > 0 ? 0 : rows.filter((row) => !invalidRows.has(row.rowNumber)).length,
        duplicateRows: rows.filter((row) => existingCodes.has(normalizeCell(row.values[codeLabel]))).length,
        errors,
        missingHeaders,
        unknownHeaders,
    };
}
function readCoreValue(definitions, row, fieldKey) {
    const definition = getDefinitionByKey(definitions, fieldKey);
    return definition ? normalizeCell(row.values[definition.label]) : "";
}
async function commitTenantDeviceImport(executor, tenantId, input) {
    (0, errors_1.assertTenantId)(tenantId);
    const duplicatePolicy = input.duplicatePolicy ?? "error";
    const preview = await previewTenantDeviceImport(executor, tenantId, input);
    if (preview.unknownHeaders.length > 0 || preview.missingHeaders.length > 0) {
        return { ...preview, created: 0, updated: 0, skipped: 0 };
    }
    const definitions = await (0, device_attributes_repository_1.listTenantDeviceAttributesWithDefaults)(executor, tenantId);
    const enabledDefinitions = definitions.filter((item) => item.enabled);
    const deviceCodeDefinition = getDefinitionByKey(enabledDefinitions, "deviceCode");
    const codeLabel = deviceCodeDefinition?.label ?? "设备编码";
    const rowErrors = new Set(preview.errors.filter((error) => error.rowNumber > 1).map((error) => error.rowNumber));
    const rows = preview.rows.filter((row) => !rowErrors.has(row.rowNumber));
    const existingCodes = await loadExistingDeviceCodes(executor, tenantId, rows.map((row) => normalizeCell(row.values[codeLabel])).filter(Boolean));
    const existingCustomAttributes = await loadExistingCustomAttributes(executor, tenantId, Array.from(existingCodes.values()));
    if (duplicatePolicy === "error" && rows.some((row) => existingCodes.has(normalizeCell(row.values[codeLabel])))) {
        const duplicateErrors = rows
            .filter((row) => existingCodes.has(normalizeCell(row.values[codeLabel])))
            .map((row) => ({ rowNumber: row.rowNumber, message: `设备编码 ${normalizeCell(row.values[codeLabel])} 已存在` }));
        return { ...preview, errors: [...preview.errors, ...duplicateErrors], created: 0, updated: 0, skipped: 0 };
    }
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const importedIds = [];
    for (const row of rows) {
        const deviceCode = normalizeCell(row.values[codeLabel]);
        const existingId = existingCodes.get(deviceCode);
        if (existingId && duplicatePolicy === "skip") {
            skipped += 1;
            continue;
        }
        const status = readCoreValue(enabledDefinitions, row, "status");
        const customAttributes = existingId
            ? { ...(existingCustomAttributes.get(existingId) ?? {}) }
            : {};
        for (const definition of enabledDefinitions) {
            if (definition.isCore)
                continue;
            if (!Object.prototype.hasOwnProperty.call(row.values, definition.label))
                continue;
            const raw = normalizeCell(row.values[definition.label]);
            customAttributes[definition.fieldKey] = definition.fieldType === "number" && raw !== "" ? Number(raw) : raw;
        }
        const name = readCoreValue(enabledDefinitions, row, "name") || deviceCode;
        const device = await (0, devices_repository_1.upsertTenantDevice)(executor, tenantId, {
            id: existingId,
            deviceCode,
            name,
            type: readCoreValue(enabledDefinitions, row, "type") || "未分类",
            area: readCoreValue(enabledDefinitions, row, "area"),
            installationLocation: readCoreValue(enabledDefinitions, row, "installationLocation") || name,
            status: deviceStatuses.has(status) ? status : "正常",
            installationStatus: readCoreValue(enabledDefinitions, row, "installationStatus"),
            lastReportAt: readCoreValue(enabledDefinitions, row, "lastReportAt") || (0, _shared_1.formatLocalTimestamp)(),
            notes: readCoreValue(enabledDefinitions, row, "notes"),
            customAttributes,
        });
        importedIds.push(device.id);
        if (existingId) {
            updated += 1;
        }
        else {
            created += 1;
        }
    }
    return {
        ...preview,
        created,
        updated,
        skipped,
        importedIds,
    };
}
