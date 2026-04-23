import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const HASH_PREFIX = "scrypt";
const KEY_LENGTH = 64;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${HASH_PREFIX}$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash?: string | null) {
  if (!storedHash) {
    return false;
  }

  const [prefix, salt, original] = storedHash.split("$");
  if (prefix !== HASH_PREFIX || !salt || !original) {
    return false;
  }

  const derived = scryptSync(password, salt, KEY_LENGTH);
  const originalBuffer = Buffer.from(original, "hex");

  if (derived.length !== originalBuffer.length) {
    return false;
  }

  return timingSafeEqual(derived, originalBuffer);
}
