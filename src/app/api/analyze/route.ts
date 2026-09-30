import { NextResponse } from "next/server";
import { analyzeJob } from "@/lib/analysis/analyze";
import { createDraft } from "@/lib/applications/repository";
import { AppError } from "@/lib/errors";
import { MAX_IMAGE_BYTES, MAX_JOB_TEXT, detectImageMime } from "@/lib/files";
import { handleError } from "@/lib/http";
import { getProfile } from "@/lib/profile/repository";
import { requireSession } from "@/lib/session";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    await requireSession();
    const form = await request.formData();
    const description = form.get("description");
    const screenshot = form.get("screenshot");
    const text = typeof description === "string" ? description.trim() : "";
    const file = screenshot instanceof File && screenshot.size > 0 ? screenshot : null;

    if (file && text) {
      throw new AppError("Send a screenshot or pasted text, not both.", 422, "invalid_source");
    }
    if (!file && text.length < 40) {
      throw new AppError("Paste the job description, or upload a screenshot.", 422, "invalid_source");
    }

    const { profile } = await getProfile();
    let analysis;
    let source: "text" | "screenshot";
    let jobDescription: string;

    if (file) {
      if (file.size > MAX_IMAGE_BYTES) {
        throw new AppError("That screenshot is too large.", 422, "image_too_large");
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const mime = detectImageMime(bytes);
      if (!mime) {
        throw new AppError("Upload a PNG, JPEG, or WebP screenshot.", 422, "image_invalid");
      }
      source = "screenshot";
      analysis = await analyzeJob({
        profile,
        source,
        image: { mime, base64: Buffer.from(bytes).toString("base64") },
      });
      jobDescription = analysis.transcript;
    } else {
      if (text.length > MAX_JOB_TEXT) {
        throw new AppError("That job description is too long.", 422, "text_too_long");
      }
      source = "text";
      analysis = await analyzeJob({ profile, source, text });
      jobDescription = text;
    }

    if (analysis.unreadable || !analysis.company.trim() || !analysis.position.trim()) {
      throw new AppError(
        analysis.unreadable
          ? "The job posting could not be read. Try a clearer screenshot or paste the text."
          : "The job title or company could not be identified.",
        422,
        analysis.unreadable ? "illegible_screenshot" : "job_not_identified",
      );
    }

    const application = await createDraft({ analysis, source, jobDescription });
    return NextResponse.json({ id: application.id });
  } catch (error) {
    return handleError(error);
  }
}
