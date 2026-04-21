import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "@/lib/auth-shared";
import { decodeSession } from "@/lib/auth";

export async function getServerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return decodeSession(token);
}
