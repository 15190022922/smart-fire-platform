import type { IncomingMessage, ServerResponse } from "http";
import { adminRepository } from "../../../../../packages/database/src/ops-repositories";
import { hashPassword } from "../../../../../lib/password";
import { readJsonBody, sendJson } from "../../lib/http";
import type { BackendRequestContext } from "../auth/auth-context";
import { requirePlatformContext } from "../auth/auth-controller";

export async function getAdminState(res: ServerResponse, context: BackendRequestContext) {
  if (!requirePlatformContext(res, context)) return;
  const payload = await adminRepository.getAdminStateData();
  sendJson(res, 200, payload);
}

export async function putAdminState(req: IncomingMessage, res: ServerResponse, context: BackendRequestContext) {
  if (!requirePlatformContext(res, context)) return;
  req.resume();
  sendJson(res, 410, {
    message: "Full admin-state replacement is disabled. Use scoped admin endpoints so tenant alarm workflow data is not overwritten.",
  });
}

export async function postAdminTenant(req: IncomingMessage, res: ServerResponse, context: BackendRequestContext) {
  if (!requirePlatformContext(res, context)) return;
  const body = (await readJsonBody(req)) as {
    tenant: {
      name: string;
      code: string;
      industry: string;
      contactName: string;
      contactPhone: string;
      status: string;
      note: string;
    };
    admin: {
      username: string;
      displayName: string;
      phone: string;
      password: string;
      roleKey: string;
      note: string;
    };
  };

  try {
    const result = await adminRepository.createTenantWithAdminRecord({
      tenant: body.tenant,
      admin: {
        ...body.admin,
        passwordHash: hashPassword(body.admin.password),
      },
    });
    sendJson(res, 200, result);
  } catch (error) {
    const message =
      error instanceof Error && /duplicate key|already exists|unique/i.test(error.message)
        ? "企业编码或管理员登录账号已存在"
        : "创建企业失败";
    sendJson(res, 400, { message });
  }
}

export async function putAdminTenant(req: IncomingMessage, res: ServerResponse, context: BackendRequestContext) {
  if (!requirePlatformContext(res, context)) return;
  const body = await readJsonBody(req);
  try {
    const tenant = await adminRepository.updateTenantRecord(body as never);
    sendJson(res, 200, { tenant });
  } catch {
    sendJson(res, 400, { message: "修改企业失败" });
  }
}

export async function deleteAdminTenant(url: URL, res: ServerResponse, context: BackendRequestContext) {
  if (!requirePlatformContext(res, context)) return;
  const tenantId = url.searchParams.get("tenantId");
  if (!tenantId) {
    sendJson(res, 400, { message: "缺少企业 ID" });
    return;
  }

  await adminRepository.deleteTenantCascadeRecord(tenantId);
  sendJson(res, 200, { success: true });
}
