import { AuthSession } from "@/types/auth";

export function encodeSession(session: AuthSession) {
  return Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
}

export function decodeSession(token: string): AuthSession | null {
  try {
    const json = Buffer.from(token, "base64url").toString("utf8");
    return JSON.parse(json) as AuthSession;
  } catch {
    return null;
  }
}
