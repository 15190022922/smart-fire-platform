export const AUTH_COOKIE_NAME = "smart-fire-auth";

export type SharedAuthScope = "platform" | "tenant";

export type SharedAuthSession = {
  userId: string;
  username: string;
  displayName: string;
  scope: SharedAuthScope;
  roleKey: string;
  tenantId?: string;
  tenantName?: string;
  defaultView?: string;
  mustChangePassword?: boolean;
};

export function decodeSharedSession(token: string): SharedAuthSession | null {
  try {
    const json = Buffer.from(token, "base64url").toString("utf8");
    return JSON.parse(json) as SharedAuthSession;
  } catch {
    return null;
  }
}
