import { NextResponse } from "next/server";
import { handleError } from "@/lib/http";
import { disconnectOutlook } from "@/lib/microsoft/msal";
import { requireSession } from "@/lib/session";

export async function POST() {
  try {
    await requireSession();
    await disconnectOutlook();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
