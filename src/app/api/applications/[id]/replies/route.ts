import { NextResponse } from "next/server";
import { getApplication, saveConversationId, saveReply } from "@/lib/applications/repository";
import { AppError } from "@/lib/errors";
import { handleError } from "@/lib/http";
import { findReply, findSentConversation } from "@/lib/microsoft/graph";
import { graphReadAccessToken, outlookStatus } from "@/lib/microsoft/msal";
import { requireSession } from "@/lib/session";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await context.params;
    const application = await getApplication(id);
    if (!application) throw new AppError("Application not found.", 404, "not_found");
    if (application.status !== "sent") {
      throw new AppError("Only sent applications can be checked for replies.", 409, "not_sent");
    }
    if (!application.recruiterEmail) {
      throw new AppError("This application has no recipient to match in Hotmail.", 422, "invalid_email");
    }

    const accessToken = await graphReadAccessToken();
    const outlook = await outlookStatus();
    let conversationId = application.conversationId;
    if (!conversationId) {
      conversationId = await findSentConversation(
        accessToken,
        application.emailSubject,
        application.recruiterEmail,
      );
      if (conversationId) await saveConversationId(id, conversationId);
    }
    if (!conversationId) {
      throw new AppError("The sent message was not found in Hotmail.", 404, "sent_not_found");
    }

    const reply = await findReply(accessToken, conversationId, outlook.accountEmail ?? "");
    await saveReply(
      id,
      reply ? { from: reply.from, preview: reply.preview, receivedAt: reply.receivedAt } : null,
    );
    return NextResponse.json({
      replied: Boolean(reply),
      from: reply?.from ?? null,
      preview: reply?.preview ?? null,
      receivedAt: reply?.receivedAt ?? null,
    });
  } catch (error) {
    return handleError(error);
  }
}
