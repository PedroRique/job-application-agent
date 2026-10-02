import { NextResponse } from "next/server";
import { z } from "zod";
import { translateEmailBody } from "@/lib/analysis/translate";
import { getApplication, updateDraft } from "@/lib/applications/repository";
import { AppError } from "@/lib/errors";
import { handleError } from "@/lib/http";
import { getProfile } from "@/lib/profile/repository";
import { requireSession } from "@/lib/session";

const bodySchema = z.object({
  language: z.enum(["pt", "en"]),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) throw new AppError("Choose Portuguese or English.", 422, "invalid_language");

    const application = await getApplication(id);
    if (!application) throw new AppError("Application not found.", 404, "not_found");
    if (application.status === "sent") {
      throw new AppError("Sent applications cannot be edited.", 409, "already_sent");
    }

    const { profile } = await getProfile();
    const body = await translateEmailBody(
      application.emailBody,
      parsed.data.language,
      profile,
      application.recruiterName,
    );
    await updateDraft(id, {
      company: application.company,
      position: application.position,
      recruiterName: application.recruiterName,
      recruiterEmail: application.recruiterEmail,
      emailSubject: application.emailSubject,
      emailBody: body,
    });
    return NextResponse.json({ body });
  } catch (error) {
    return handleError(error);
  }
}
