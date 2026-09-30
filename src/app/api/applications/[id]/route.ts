import { NextResponse } from "next/server";
import { getApplication, parseDraft, updateDraft } from "@/lib/applications/repository";
import { AppError } from "@/lib/errors";
import { handleError } from "@/lib/http";
import { requireSession } from "@/lib/session";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const application = await getApplication(id);
    if (!application) throw new AppError("Application not found.", 404, "not_found");
    return NextResponse.json(application);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const draft = parseDraft(await request.json());
    await updateDraft(id, draft);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
