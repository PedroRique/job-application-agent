import { NextResponse } from "next/server";
import {
  getApplication,
  lockForSend,
  markFailed,
  markSent,
  parseSend,
  saveConversationId,
} from "@/lib/applications/repository";
import { AppError } from "@/lib/errors";
import { handleError } from "@/lib/http";
import { sendMail, findSentConversation } from "@/lib/microsoft/graph";
import { graphAccessToken, graphReadAccessToken } from "@/lib/microsoft/msal";
import { downloadResume, getLatestResume } from "@/lib/resume";
import { requireSession } from "@/lib/session";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const draft = parseSend(await request.json());
    const existing = await getApplication(id);
    if (!existing) throw new AppError("Application not found.", 404, "not_found");
    if (existing.status === "sent") {
      throw new AppError("This application was already sent.", 409, "already_sent");
    }

    const resume = await getLatestResume();
    if (!resume) throw new AppError("Resume is not configured.", 409, "resume_missing");
    const pdf = await downloadResume(resume.storagePath);
    const accessToken = await graphAccessToken();

    const locked = await lockForSend(id, draft);
    if (!locked) throw new AppError("This application is already being sent.", 409, "send_in_progress");

    try {
      await sendMail({
        accessToken,
        to: draft.recruiterEmail,
        subject: draft.emailSubject,
        body: draft.emailBody,
        attachmentName: resume.fileName,
        attachment: pdf,
      });
    } catch (error) {
      const message =
        error instanceof AppError
          ? error.message
          : "The email could not be sent. It was not marked as sent.";
      await markFailed(id, message);
      throw error instanceof AppError
        ? error
        : new AppError(message, 502, "send_failed");
    }

    try {
      await markSent(id);
    } catch {
      return NextResponse.json({
        status: "sent",
        warning:
          "The email was accepted by Outlook, but the history could not be updated. Check your Sent folder before sending again.",
      });
    }

    try {
      const readToken = await graphReadAccessToken();
      const conversationId = await findSentConversation(readToken, draft.emailSubject, draft.recruiterEmail);
      if (conversationId) await saveConversationId(id, conversationId);
    } catch {
      console.error("sent_lookup_failed");
    }

    return NextResponse.json({ status: "sent" });
  } catch (error) {
    return handleError(error);
  }
}
