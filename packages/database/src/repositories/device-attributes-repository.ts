import type { DbExecutor } from "../client";
import { withDbClient } from "../client";
import { assertTenantId } from "../errors";
import { formatLocalTimestamp } from "./_shared";
import type { DeviceAttributeType, TenantDeviceAttributeDefinition } from "../../../../types/saas";

const attributeTypes = new Set<DeviceAttributeType>(["auto", "text", "number", "date", "boolean"]);

export const coreDeviceAttributeDefinitions: Omit<TenantDeviceAttributeDefinition, "tenantId">[] = [
  { fieldKey: "deviceCode", label: "设备编码", fieldType: "text", required: true, enabled: true, showInList: true, sortOrder: 10, isCore: true },
  { fieldKey: "name", label: "设备名称", fieldType: "text", required: true, enabled: true, showInList: true, sortOrder: 20, isCore: true },
  { fieldKey: "type", label: "设备类型", fieldType: "text", required: true, enabled: true, showInList: true, sortOrder: 30, isCore: true },
  { fieldKey: "area", label: "所属区域/楼层", fieldType: "text", required: true, enabled: true, showInList: true, sortOrder: 40, isCore: true },
  {
    fieldKey: "installationLocation",
    label: "安装位置",
    fieldType: "text",
    required: true,
    enabled: true,
    showInList: true,
    sortOrder: 50,
    isCore: true,
  },
  {
    fieldKey: "installationStatus",
    label: "安装状态",
    fieldType: "text",
    required: false,
    enabled: true,
    showInList: true,
    sortOrder: 60,
    isCore: true,
  },
  { fieldKey: "status", label: "实时状态", fieldType: "text", required: false, enabled: true, showInList: true, sortOrder: 70, isCore: true },
  {
    fieldKey: "lastReportAt",
    label: "最近上报时间",
    fieldType: "date",
    required: false,
    enabled: true,
    showInList: false,
    sortOrder: 80,
    isCore: true,
  },
  { fieldKey: "notes", label: "备注", fieldType: "text", required: false, enabled: true, showInList: false, sortOrder: 90, isCore: true },
];

function mapDeviceAttribute(row: any): TenantDeviceAttributeDefinition {
  return {
    tenantId: row.tenant_id,
    fieldKey: row.field_key,
    label: row.label,
    fieldType: row.field_type,
    required: Boolean(row.required),
    enabled: Boolean(row.enabled),
    showInList: Boolean(row.show_in_list),
    sortOrder: Number(row.sort_order),
    isCore: Boolean(row.is_core),
  };
}

function createCustomFieldKey() {
  return `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function ensureCoreDeviceAttributeDefinitions(executor: DbExecutor, tenantId: string) {
  assertTenantId(tenantId);
  const now = formatLocalTimestamp();
  for (const definition of coreDeviceAttributeDefinitions) {
    await executor.query(
      `
        INSERT INTO tenant_device_attribute_definitions (
          tenant_id, field_key, label, field_type, required, enabled, show_in_list, sort_order, is_core, created_at, updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
        ON CONFLICT (tenant_id, field_key) DO NOTHING
      `,
      [
        tenantId,
        definition.fieldKey,
        definition.label,
        definition.fieldType,
        definition.required,
        definition.enabled,
        definition.showInList,
        definition.sortOrder,
        definition.isCore,
        now,
      ],
    );
  }
}

export async function listTenantDeviceAttributes(tenantId: string) {
  assertTenantId(tenantId);
  return withDbClient(async (client) => listTenantDeviceAttributesWithDefaults(client, tenantId));
}

export async function listTenantDeviceAttributesWithDefaults(executor: DbExecutor, tenantId: string) {
  await ensureCoreDeviceAttributeDefinitions(executor, tenantId);
  const result = await executor.query("SELECT * FROM tenant_device_attribute_definitions WHERE tenant_id = $1 ORDER BY sort_order ASC, label ASC", [
    tenantId,
  ]);
  return result.rows.map(mapDeviceAttribute);
}

async function assertLabelAvailable(executor: DbExecutor, tenantId: string, label: string, fieldKey: string) {
  const result = await executor.query(
    "SELECT field_key FROM tenant_device_attribute_definitions WHERE tenant_id = $1 AND label = $2 AND field_key <> $3 AND enabled = TRUE LIMIT 1",
    [tenantId, label, fieldKey],
  );
  if (result.rows[0]) {
    throw new Error("字段名称已存在，请换一个名称");
  }
}

async function customAttributeHasValues(executor: DbExecutor, tenantId: string, fieldKey: string) {
  const result = await executor.query(
    `
      SELECT id
      FROM tenant_devices
      WHERE tenant_id = $1
        AND custom_attributes ? $2
        AND NULLIF(TRIM(custom_attributes ->> $2), '') IS NOT NULL
      LIMIT 1
    `,
    [tenantId, fieldKey],
  );
  return Boolean(result.rows[0]);
}

function canChangeTypeWithExistingValues(fromType: DeviceAttributeType, toType: DeviceAttributeType) {
  if (fromType === toType) return true;
  if (toType === "auto") return true;
  if (fromType === "auto" && toType === "text") return true;
  return false;
}

export async function upsertTenantDeviceAttribute(
  executor: DbExecutor,
  tenantId: string,
  input: {
    fieldKey?: string;
    label?: string;
    fieldType?: string;
    required?: boolean;
    enabled?: boolean;
    showInList?: boolean;
    sortOrder?: number;
  },
) {
  assertTenantId(tenantId);
  await ensureCoreDeviceAttributeDefinitions(executor, tenantId);

  const fieldKey = String(input.fieldKey || createCustomFieldKey()).trim();
  const label = String(input.label || "").trim();
  const now = formatLocalTimestamp();
  if (!label) {
    throw new Error("字段名称不能为空");
  }

  const existingResult = await executor.query("SELECT * FROM tenant_device_attribute_definitions WHERE tenant_id = $1 AND field_key = $2 LIMIT 1", [
    tenantId,
    fieldKey,
  ]);
  const existing = existingResult.rows[0] ? mapDeviceAttribute(existingResult.rows[0]) : null;
  await assertLabelAvailable(executor, tenantId, label, fieldKey);

  if (existing?.isCore) {
    await executor.query(
      `
        UPDATE tenant_device_attribute_definitions
        SET label = $1, show_in_list = $2, sort_order = $3, updated_at = $4
        WHERE tenant_id = $5 AND field_key = $6
      `,
      [label, input.showInList ?? existing.showInList, Number(input.sortOrder ?? existing.sortOrder), now, tenantId, fieldKey],
    );
  } else if (existing) {
    const nextType = (input.fieldType || existing.fieldType) as DeviceAttributeType;
    if (!attributeTypes.has(nextType)) {
      throw new Error("字段类型不支持");
    }
    if (
      nextType !== existing.fieldType &&
      !canChangeTypeWithExistingValues(existing.fieldType, nextType) &&
      (await customAttributeHasValues(executor, tenantId, fieldKey))
    ) {
      throw new Error("该字段已有设备数据，不能修改字段类型");
    }
    await executor.query(
      `
        UPDATE tenant_device_attribute_definitions
        SET label = $1, field_type = $2, required = $3, enabled = $4, show_in_list = $5, sort_order = $6, updated_at = $7
        WHERE tenant_id = $8 AND field_key = $9
      `,
      [
        label,
        nextType,
        Boolean(input.required ?? existing.required),
        Boolean(input.enabled ?? existing.enabled),
        Boolean(input.showInList ?? existing.showInList),
        Number(input.sortOrder ?? existing.sortOrder),
        now,
        tenantId,
        fieldKey,
      ],
    );
  } else {
    const fieldType = (input.fieldType || "auto") as DeviceAttributeType;
    if (!attributeTypes.has(fieldType)) {
      throw new Error("字段类型不支持");
    }
    await executor.query(
      `
        INSERT INTO tenant_device_attribute_definitions (
          tenant_id, field_key, label, field_type, required, enabled, show_in_list, sort_order, is_core, created_at, updated_at
        )
        VALUES ($1,$2,$3,$4,$5,TRUE,$6,$7,FALSE,$8,$8)
      `,
      [tenantId, fieldKey, label, fieldType, Boolean(input.required), Boolean(input.showInList), Number(input.sortOrder ?? 100), now],
    );
  }

  const result = await executor.query("SELECT * FROM tenant_device_attribute_definitions WHERE tenant_id = $1 AND field_key = $2", [
    tenantId,
    fieldKey,
  ]);
  return mapDeviceAttribute(result.rows[0]);
}

export async function disableTenantDeviceAttribute(executor: DbExecutor, tenantId: string, fieldKey: string) {
  assertTenantId(tenantId);
  await ensureCoreDeviceAttributeDefinitions(executor, tenantId);
  const result = await executor.query("SELECT * FROM tenant_device_attribute_definitions WHERE tenant_id = $1 AND field_key = $2 LIMIT 1", [
    tenantId,
    fieldKey,
  ]);
  const existing = result.rows[0] ? mapDeviceAttribute(result.rows[0]) : null;
  if (!existing) {
    throw new Error("字段不存在");
  }
  if (existing.isCore) {
    throw new Error("核心字段不能删除");
  }

  await executor.query(
    "UPDATE tenant_device_attribute_definitions SET enabled = FALSE, updated_at = $1 WHERE tenant_id = $2 AND field_key = $3",
    [formatLocalTimestamp(), tenantId, fieldKey],
  );
  return { success: true };
}
