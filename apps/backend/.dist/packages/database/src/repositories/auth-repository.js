"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLoginAccountByUsername = getLoginAccountByUsername;
exports.findLoginAccountByCredentials = findLoginAccountByCredentials;
exports.updateLoginPasswordByUsername = updateLoginPasswordByUsername;
const password_1 = require("../../../../lib/password");
const client_1 = require("../client");
const errors_1 = require("../errors");
function mapLoginAccount(row) {
    return {
        id: String(row.id),
        username: String(row.username),
        password: row.password ? String(row.password) : undefined,
        passwordHash: row.password_hash ? String(row.password_hash) : undefined,
        displayName: String(row.display_name),
        scope: row.scope,
        roleKey: row.role_key,
        tenantId: row.tenant_id ? String(row.tenant_id) : undefined,
        mustChangePassword: Boolean(row.must_change_password),
    };
}
async function getLoginAccountByUsername(username) {
    const row = await (0, client_1.queryDb)("SELECT * FROM login_accounts WHERE username = $1 LIMIT 1", [username]);
    return row.rows[0] ? mapLoginAccount(row.rows[0]) : null;
}
async function findLoginAccountByCredentials(username, password) {
    const account = await getLoginAccountByUsername(username);
    if (!account)
        return null;
    const passwordMatched = (0, password_1.verifyPassword)(password, account.passwordHash) || (!!account.password && account.password === password);
    if (!passwordMatched)
        return null;
    if (!account.passwordHash) {
        await (0, client_1.queryDb)("UPDATE login_accounts SET password_hash = $1 WHERE id = $2", [(0, password_1.hashPassword)(password), account.id]);
    }
    return account;
}
async function updateLoginPasswordByUsername(username, nextPassword) {
    const account = await getLoginAccountByUsername(username);
    if (!account) {
        throw new errors_1.EntityNotFoundError("login_account", username);
    }
    const passwordHash = (0, password_1.hashPassword)(nextPassword);
    await (0, client_1.queryDb)("UPDATE login_accounts SET password = '', password_hash = $1, must_change_password = FALSE WHERE username = $2", [passwordHash, username]);
}
