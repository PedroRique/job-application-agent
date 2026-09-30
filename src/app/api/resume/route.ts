import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { handleError } from "@/lib/http";
import { getLatestResume, saveResume } from "@/lib/resume";
import { requireSession } from "@/lib/session";

export async function GET() {
  try {
    await requireSession();
    const resume = await getLatestResume();
    if (!resume) return NextResponse.json({ resume: null });
    return NextResponse.json({
      resume: {
        fileName: resume.fileName,
        sizeBytes: resume.sizeBytes,
        createdAt: resume.createdAt,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSession();
    const form = await request.formData();
    const file = form.get("resume");
    if (!(file instanceof File) || file.size === 0) {
      throw new AppError("Choose a PDF resume.", 422, "resume_invalid");
    }
    const saved = await saveResume(file.name, new Uint8Array(await file.arrayBuffer()));
    return NextResponse.json({
      resume: {
        fileName: saved.fileName,
        sizeBytes: saved.sizeBytes,
        createdAt: saved.createdAt,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
