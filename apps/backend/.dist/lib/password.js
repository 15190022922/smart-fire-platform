"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
const node_crypto_1 = require("node:crypto");
const HASH_PREFIX = "scrypt";
const KEY_LENGTH = 64;
function hashPassword(password) {
    const salt = (0, node_crypto_1.randomBytes)(16).toString("hex");
    const derived = (0, node_crypto_1.scryptSync)(password, salt, KEY_LENGTH).toString("hex");
    return `${HASH_PREFIX}$${salt}$${derived}`;
}
function verifyPassword(password, storedHash) {
    if (!storedHash) {
        return false;
    }
    const [prefix, salt, original] = storedHash.split("$");
    if (prefix !== HASH_PREFIX || !salt || !original) {
        return false;
    }
    const derived = (0, node_crypto_1.scryptSync)(password, salt, KEY_LENGTH);
    const originalBuffer = Buffer.from(original, "hex");
    if (derived.length !== originalBuffer.length) {
        return false;
    }
    return (0, node_crypto_1.timingSafeEqual)(derived, originalBuffer);
}
