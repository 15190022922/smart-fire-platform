import type { DbExecutor } from "../client";
import { queryDb } from "../client";
import { assertTenantId } from "../errors";
import { createId } from "./_shared";
import { mapTenantUser } from "./_shared";

export async function listTenantUsers(tenantId: string) {
  assertTenantId(tenantId);
  const result = await queryDb("SELECT * FROM tenant_users WHERE tenant_id = $1 ORDER BY username ASC", [tenantId]);
  return result.rows.map(mapTenantUser);
}

export async function upsertTenantUser(executor: DbExecutor, tenantId: string, input: any) {
  assertTenantId(tenantId);
  const id = input.id ? String(input.id) : createId("tenant-user");
  const messageTypes = Array.isArray(input.messageTypes) ? input.messageTypes : [];
  await executor.query(
    `
      INSERT INTO tenant_users (id, tenant_id, username, phone, role_key, status, sms_enabled, message_types, note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
      ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        phone = EXCLUDED.phone,
        role_key = EXCLUDED.role_key,
        status = EXCLUDED.status,
        sms_enabled = EXCLUDED.sms_enabled,
        message_types = EXCLUDED.message_types,
        note = EXCLUDED.note
    `,
    [id, tenantId, input.username, input.phone, input.roleKey, input.status, Boolean(input.smsEnabled), JSON.stringify(messageTypes), input.note ?? ""],
  );
  const row = (await executor.query("SELECT * FROM tenant_users WHERE id = $1 AND tenant_id = $2", [id, tenantId])).rows[0];
  return mapTenantUser(row);
}

export async function deleteTenantUser(executor: DbExecutor, tenantId: string, id: string) {
  assertTenantId(tenantId);
  await executor.query("DELETE FROM tenant_users WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
}
