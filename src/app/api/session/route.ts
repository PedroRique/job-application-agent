import { NextResponse } from "next/server";
import { handleError } from "@/lib/http";
import {
  SESSION_COOKIE,
  appLockConfigured,
  checkPassword,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/session";
import { AppError } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    if (!appLockConfigured()) {
      throw new AppError("App access is not configured.", 503, "app_lock_not_configured");
    }
    const body = (await request.json()) as { password?: unknown };
    const password = typeof body.password === "string" ? body.password : "";
    if (!checkPassword(password)) {
      throw new AppError("Wrong password.", 401, "unauthorized");
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, createSessionToken(), sessionCookieOptions());
    return response;
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
