import { hashPassword, verifyPassword } from "../../../../lib/password";
import type { LoginAccount } from "../../../../types/auth";
import { queryDb } from "../client";
import { EntityNotFoundError } from "../errors";

function mapLoginAccount(row: Record<string, unknown>): LoginAccount {
  return {
    id: String(row.id),
    username: String(row.username),
    password: row.password ? String(row.password) : undefined,
    passwordHash: row.password_hash ? String(row.password_hash) : undefined,
    displayName: String(row.display_name),
    scope: row.scope as LoginAccount["scope"],
    roleKey: row.role_key as LoginAccount["roleKey"],
    tenantId: row.tenant_id ? String(row.tenant_id) : undefined,
    mustChangePassword: Boolean(row.must_change_password),
  };
}

export async function getLoginAccountByUsername(username: string) {
  const row = await queryDb("SELECT * FROM login_accounts WHERE username = $1 LIMIT 1", [username]);
  return row.rows[0] ? mapLoginAccount(row.rows[0]) : null;
}

export async function findLoginAccountByCredentials(username: string, password: string) {
  const account = await getLoginAccountByUsername(username);
  if (!account) return null;

  const passwordMatched =
    verifyPassword(password, account.passwordHash) || (!!account.password && account.password === password);
  if (!passwordMatched) return null;

  if (!account.passwordHash) {
    await queryDb("UPDATE login_accounts SET password_hash = $1 WHERE id = $2", [hashPassword(password), account.id]);
  }

  return account;
}

export async function updateLoginPasswordByUsername(username: string, nextPassword: string) {
  const account = await getLoginAccountByUsername(username);
  if (!account) {
    throw new EntityNotFoundError("login_account", username);
  }
  const passwordHash = hashPassword(nextPassword);
  await queryDb(
    "UPDATE login_accounts SET password = '', password_hash = $1, must_change_password = FALSE WHERE username = $2",
    [passwordHash, username],
  );
}
