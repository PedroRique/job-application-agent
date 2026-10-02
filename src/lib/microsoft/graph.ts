import { AppError } from "@/lib/errors";
import { matchSentConversation, pickReply } from "@/lib/microsoft/mail-match";

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

type GraphSent = {
  conversationId?: string;
  subject?: string;
  toRecipients?: { emailAddress?: { address?: string } }[];
};

type GraphInbox = {
  from?: { emailAddress?: { address?: string } };
  receivedDateTime?: string;
  bodyPreview?: string;
};

async function graphGet(accessToken: string, url: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status === 401 || response.status === 403) {
    throw new AppError("Reconnect Outlook to check replies.", 401, "oauth_expired");
  }
  if (!response.ok) throw new AppError("Hotmail could not be read.", 502, "mail_read_failed");
  return (await response.json()) as { value?: unknown[] };
}

export async function findSentConversation(accessToken: string, subject: string, to: string) {
  const url = new URL("https://graph.microsoft.com/v1.0/me/mailFolders/sentitems/messages");
  url.searchParams.set("$top", "25");
  url.searchParams.set("$select", "conversationId,subject,toRecipients,sentDateTime");
  url.searchParams.set("$orderby", "sentDateTime desc");
  let payload: { value?: unknown[] };
  try {
    payload = await graphGet(accessToken, url.toString());
  } catch (error) {
    if (error instanceof AppError && error.code === "oauth_expired") throw error;
    url.searchParams.delete("$orderby");
    payload = await graphGet(accessToken, url.toString());
  }
  const messages = (payload.value ?? []).flatMap((item) => {
    const row = item as GraphSent;
    if (!row.conversationId) return [];
    return [
      {
        conversationId: row.conversationId,
        subject: row.subject ?? "",
        recipients: (row.toRecipients ?? [])
          .map((recipient) => recipient.emailAddress?.address ?? "")
          .filter(Boolean),
      },
    ];
  });
  return matchSentConversation(messages, subject, to);
}

export async function findReply(accessToken: string, conversationId: string, ownEmail: string) {
  const url = new URL("https://graph.microsoft.com/v1.0/me/messages");
  url.searchParams.set("$filter", `conversationId eq '${conversationId.replaceAll("'", "''")}'`);
  url.searchParams.set("$top", "25");
  url.searchParams.set("$select", "from,receivedDateTime,bodyPreview");
  const payload = await graphGet(accessToken, url.toString());
  const messages = (payload.value ?? []).flatMap((item) => {
    const row = item as GraphInbox;
    const from = row.from?.emailAddress?.address ?? "";
    if (!from || !row.receivedDateTime) return [];
    return [{ from, receivedAt: row.receivedDateTime, preview: (row.bodyPreview ?? "").slice(0, 280) }];
  });
  return pickReply(messages, ownEmail);
}
