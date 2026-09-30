import { NextResponse, type NextRequest } from "next/server";
import { handleError } from "@/lib/http";
import { microsoftAuthUrl } from "@/lib/microsoft/msal";
import { oauthState, requireSession, sessionCookieOptions } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    await requireSession();
    const state = oauthState();
    const url = await microsoftAuthUrl(state);
    const response = NextResponse.redirect(url);
    response.cookies.set("ms_oauth_state", state, { ...sessionCookieOptions(), maxAge: 600 });
    return response;
  } catch (error) {
    const handled = handleError(error);
    if (handled.status === 401) {
      return NextResponse.redirect(new URL("/login", request.nextUrl.origin));
    }
    return NextResponse.redirect(new URL("/profile?outlook=failed", request.nextUrl.origin));
  }
}
