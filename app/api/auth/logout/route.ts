import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth-shared";

export async function POST() {
  const response = NextResponse.json({ message: "已退出登录" });
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
