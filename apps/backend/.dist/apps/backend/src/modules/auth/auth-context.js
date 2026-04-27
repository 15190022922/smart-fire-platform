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
function isDevelopmentMockContextEnabled() {
    return process.env.NODE_ENV !== "production" && process.env.BACKEND_ALLOW_HEADER_CONTEXT !== "0";
}
function hasTrustedInternalToken(req) {
    const expected = process.env.BACKEND_INTERNAL_TOKEN;
    if (!expected)
        return false;
    const actual = req.headers["x-backend-internal-token"];
    return typeof actual === "string" && actual === expected;
}
function readTrustedHeaderContext(req) {
    const allowHeaderContext = isDevelopmentMockContextEnabled() || hasTrustedInternalToken(req);
    if (!allowHeaderContext) {
        return null;
    }
    const scopeHeader = req.headers["x-user-scope"];
    const tenantHeader = req.headers["x-tenant-id"];
    const userNameHeader = req.headers["x-user-name"];
    const userRoleHeader = req.headers["x-user-role"];
    return {
        tenantId: typeof tenantHeader === "string" ? tenantHeader : null,
        scope: typeof scopeHeader === "string" ? scopeHeader : null,
        userName: decodeHeaderValue(typeof userNameHeader === "string" ? userNameHeader : undefined) ?? null,
        userRole: (typeof userRoleHeader === "string" ? userRoleHeader : undefined) ?? null,
    };
}
function resolveRequestContext(req) {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies.get(auth_1.AUTH_COOKIE_NAME);
    const cookieSession = token ? (0, auth_1.decodeSharedSession)(token) : null;
    const headerContext = readTrustedHeaderContext(req);
    return {
        session: cookieSession,
        tenantId: cookieSession?.tenantId ?? headerContext?.tenantId ?? null,
        scope: cookieSession?.scope ?? headerContext?.scope ?? null,
        userName: cookieSession?.displayName ?? headerContext?.userName ?? null,
        userRole: cookieSession?.roleKey ?? headerContext?.userRole ?? null,
    };
}
