import assert from "node:assert/strict";
import test from "node:test";
import { matchSentConversation, pickReply } from "./mail-match";

test("matches the sent message by subject and recipient", () => {
  const id = matchSentConversation(
    [
      { conversationId: "other", subject: "Hello", recipients: ["a@acme.com"] },
      {
        conversationId: "thread-1",
        subject: "Application | Frontend | Pedro Rique",
        recipients: ["Recruiter@Acme.com"],
      },
    ],
    "Application | Frontend | Pedro Rique",
    "recruiter@acme.com",
  );
  assert.equal(id, "thread-1");
});

test("picks the newest message that is not from the sender", () => {
  const reply = pickReply(
    [
      { from: "pedroh.rique@hotmail.com", receivedAt: "2026-10-02T12:00:00Z", preview: "mine" },
      { from: "recruiter@acme.com", receivedAt: "2026-10-02T13:00:00Z", preview: "thanks" },
      { from: "recruiter@acme.com", receivedAt: "2026-10-02T15:00:00Z", preview: "later" },
    ],
    "PedroH.Rique@hotmail.com",
  );
  assert.equal(reply?.preview, "later");
});
