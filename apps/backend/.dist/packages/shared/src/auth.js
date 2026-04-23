"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTH_COOKIE_NAME = void 0;
exports.decodeSharedSession = decodeSharedSession;
exports.AUTH_COOKIE_NAME = "smart-fire-auth";
function decodeSharedSession(token) {
    try {
        const json = Buffer.from(token, "base64url").toString("utf8");
        return JSON.parse(json);
    }
    catch {
        return null;
    }
}
