"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveRequestContext = resolveRequestContext;
const auth_1 = require("../../../../../packages/shared/src/auth");
function decodeHeaderValue(value) {
    if (!value)
        return undefined;
    try {
        return decodeURIComponent(value);
    }
    catch {
        return value;
    }
}
function parseCookies(cookieHeader) {
    if (!cookieHeader)
        return new Map();
    return new Map(cookieHeader.split(";").map((part) => {
        const [key, ...rest] = part.trim().split("=");
        return [key, rest.join("=")];
    }));
}
function resolveRequestContext(req) {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies.get(auth_1.AUTH_COOKIE_NAME);
    const cookieSession = token ? (0, auth_1.decodeSharedSession)(token) : null;
    const scopeHeader = req.headers["x-user-scope"];
    const tenantHeader = req.headers["x-tenant-id"];
    const userNameHeader = req.headers["x-user-name"];
    const userRoleHeader = req.headers["x-user-role"];
    return {
        session: cookieSession,
        tenantId: (typeof tenantHeader === "string" ? tenantHeader : undefined) ??
            cookieSession?.tenantId ??
            null,
        scope: (typeof scopeHeader === "string" ? scopeHeader : undefined) ??
            cookieSession?.scope ??
            null,
        userName: decodeHeaderValue(typeof userNameHeader === "string" ? userNameHeader : undefined) ??
            cookieSession?.displayName ??
            null,
        userRole: (typeof userRoleHeader === "string" ? userRoleHeader : undefined) ??
            cookieSession?.roleKey ??
            null,
    };
}
