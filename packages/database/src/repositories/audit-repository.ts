import type { DbExecutor } from "../client";
import { queryDb } from "../client";
import { assertTenantId } from "../errors";
import { withTransaction } from "../transaction";
import { createId, formatLocalTimestamp } from "./_shared";
import { mapAuditLog } from "./_shared";

export async function listTenantAuditLogs(tenantId: string) {
  assertTenantId(tenantId);
  const result = await queryDb("SELECT * FROM audit_logs WHERE tenant_id = $1 OR tenant_id IS NULL ORDER BY created_at DESC LIMIT 500", [tenantId]);
  return result.rows.map(mapAuditLog);
}

export async function insertAuditLog(
  executor: DbExecutor,
  input: {
    id: string;
    tenantId?: string;
    actorScope: "platform" | "tenant";
    actorName: string;
    actorRole: string;
    action: string;
    targetType: string;
    targetId: string;
    result: "success" | "error";
    detail: string;
    createdAt: string;
  },
) {
  if (input.tenantId) {
    assertTenantId(input.tenantId);
  }
  await executor.query(
    `INSERT INTO audit_logs (id, tenant_id, actor_scope, actor_name, actor_role, action, target_type, target_id, result, detail, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      input.id,
      input.tenantId ?? null,
      input.actorScope,
      input.actorName,
      input.actorRole,
      input.action,
      input.targetType,
      input.targetId,
      input.result,
      input.detail,
      input.createdAt,
    ],
  );
}

export async function createAuditLogEntry(input: {
  tenantId?: string;
  actorScope: "platform" | "tenant";
  actorName: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  result: "success" | "error";
  detail: string;
  createdAt?: string;
}) {
  return withTransaction(async (client) => {
    await insertAuditLog(client, {
      id: createId("audit"),
      ...input,
      createdAt: input.createdAt ?? formatLocalTimestamp(),
    });
  });
}
