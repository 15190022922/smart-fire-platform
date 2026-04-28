import { cookies } from "next/headers";
import { headers } from "next/headers";
import { AUTH_COOKIE_NAME } from "@/lib/auth-shared";
import { decodeSession } from "@/lib/auth";

export async function getServerSession() {
  const headerStore = await headers();
  const pinnedToken = headerStore.get("x-smart-fire-session");
  const pinnedSession = pinnedToken ? decodeSession(pinnedToken) : null;
  if (pinnedSession) {
    return pinnedSession;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return decodeSession(token);
}

export async function getServerSessionToken() {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE_NAME)?.value ?? "";
}
