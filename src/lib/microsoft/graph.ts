import { AppError } from "@/lib/errors";

export async function sendMail(input: {
  accessToken: string;
  to: string;
  subject: string;
  body: string;
  attachmentName: string;
  attachment: Uint8Array;
}) {
  const payload = {
    message: {
      subject: input.subject,
      body: { contentType: "Text", content: input.body },
      toRecipients: [{ emailAddress: { address: input.to } }],
      attachments: [
        {
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: input.attachmentName,
          contentType: "application/pdf",
          contentBytes: Buffer.from(input.attachment).toString("base64"),
        },
      ],
    },
    saveToSentItems: true,
  };

  let response: Response;
  try {
    response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new AppError("The email could not be sent. It was not marked as sent.", 502, "send_failed");
  }

  if (response.status === 202) return;
  console.error("graph_send", response.status);
  if (response.status === 401) {
    throw new AppError("Outlook session expired. Connect Outlook again.", 401, "oauth_expired");
  }
  throw new AppError("The email could not be sent. It was not marked as sent.", 502, "send_failed");
}
