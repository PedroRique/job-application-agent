import { NextResponse } from "next/server";
import { handleError } from "@/lib/http";
import { candidateProfileSchema } from "@/lib/profile/schema";
import { getProfile, saveProfile } from "@/lib/profile/repository";
import { requireSession } from "@/lib/session";
import { AppError } from "@/lib/errors";

export async function GET() {
  try {
    await requireSession();
    const { profile } = await getProfile();
    return NextResponse.json(profile);
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(request: Request) {
  try {
    await requireSession();
    const parsed = candidateProfileSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new AppError("Check the profile fields and try again.", 422, "invalid_profile");
    }
    const profile = await saveProfile(parsed.data);
    return NextResponse.json(profile);
  } catch (error) {
    return handleError(error);
  }
}
