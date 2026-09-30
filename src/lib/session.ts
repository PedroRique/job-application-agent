import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { AppError } from "@/lib/errors";

const COOKIE = "jaa_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

export function appLockConfigured() {
  const password = process.env.APP_PASSWORD ?? "";
  const secret = process.env.SESSION_SECRET ?? "";
  return password.length >= 8 && secret.length >= 16;
}

function secret() {
  const value = process.env.SESSION_SECRET ?? "";
  if (value.length < 16) {
    throw new AppError("App access is not configured.", 503, "app_lock_not_configured");
  }
  return value;
}

function sign(payload: string) {
  const mac = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

function passwordsMatch(input: string, expected: string) {
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function createSessionToken() {
  const payload = Buffer.from(
    JSON.stringify({ exp: Date.now() + MAX_AGE_SECONDS * 1000 }),
  ).toString("base64url");
  return sign(payload);
}

export function readSessionToken(token: string | undefined) {
  if (!token || !appLockConfigured()) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      exp?: number;
    };
    return typeof parsed.exp === "number" && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

export async function getSession() {
  const jar = await cookies();
  return readSessionToken(jar.get(COOKIE)?.value);
}

export async function requireSession() {
  if (!appLockConfigured()) {
    throw new AppError("App access is not configured.", 503, "app_lock_not_configured");
  }
  if (!(await getSession())) {
    throw new AppError("Sign in required.", 401, "unauthorized");
  }
}

export function checkPassword(input: string) {
  const expected = process.env.APP_PASSWORD ?? "";
  if (!appLockConfigured()) return false;
  return passwordsMatch(input, expected);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}

export const SESSION_COOKIE = COOKIE;

export function oauthState() {
  return randomBytes(16).toString("base64url");
}
