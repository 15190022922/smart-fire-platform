import type { IncomingMessage, ServerResponse } from "http";
import { tenantUserRepository } from "../../../../../packages/database/src/tenant-repositories";
import { readJsonBody, sendJson } from "../../lib/http";
import type { BackendRequestContext } from "../auth/auth-context";
import { requireTenantContext } from "../auth/auth-controller";

export async function getUsers(res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const users = await tenantUserRepository.list(context.tenantId!);
  sendJson(res, 200, { users });
}

export async function postUser(req: IncomingMessage, res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const body = await readJsonBody<Record<string, unknown>>(req);
  const user = await tenantUserRepository.upsert(context.tenantId!, body);
  sendJson(res, 200, { user });
}

export async function deleteUser(url: URL, res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;
  const id = url.searchParams.get("id");
  if (!id) {
    sendJson(res, 400, { message: "缺少用户 ID" });
    return;
  }
  await tenantUserRepository.remove(context.tenantId!, id);
  sendJson(res, 200, { success: true });
}
