export type SentCandidate = {
  conversationId: string;
  subject: string;
  recipients: string[];
};

export type InboxMessage = {
  from: string;
  receivedAt: string;
  preview: string;
};

export function matchSentConversation(messages: SentCandidate[], subject: string, to: string) {
  const wanted = subject.trim().toLowerCase();
  const target = to.trim().toLowerCase();
  return (
    messages.find(
      (message) =>
        message.subject.trim().toLowerCase() === wanted &&
        message.recipients.some((address) => address.trim().toLowerCase() === target),
    )?.conversationId ?? null
  );
}

export function pickReply(messages: InboxMessage[], ownEmail: string) {
  const own = ownEmail.trim().toLowerCase();
  return (
    messages
      .filter((message) => message.from.trim().toLowerCase() !== own)
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0] ?? null
  );
}
