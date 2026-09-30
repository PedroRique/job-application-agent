import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { connectOutlook } from "@/lib/microsoft/msal";
import { requireSession, sessionCookieOptions } from "@/lib/session";

function statesMatch(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function back(request: NextRequest, code: string) {
  const response = NextResponse.redirect(new URL(`/profile?outlook=${code}`, request.nextUrl.origin));
  response.cookies.set("ms_oauth_state", "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  try {
    await requireSession();
  } catch {
    return NextResponse.redirect(new URL("/login", request.nextUrl.origin));
  }

  const providerError = request.nextUrl.searchParams.get("error");
  if (providerError === "access_denied") return back(request, "cancelled");
  if (providerError) return back(request, "failed");

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expected = request.cookies.get("ms_oauth_state")?.value;
  if (!code || !state || !expected || !statesMatch(state, expected)) return back(request, "failed");

  try {
    await connectOutlook(code);
    return back(request, "connected");
  } catch (error) {
    console.error("microsoft_callback", error instanceof Error ? error.name : "error");
    return back(request, "failed");
  }
}
