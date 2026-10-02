import { z } from "zod";
import { jobAnalysisSchema, type ApplicationStatus, type JobAnalysis, type JobSource } from "@/lib/analysis/schema";
import { AppError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase/admin";

export type ApplicationRecord = {
  id: string;
  createdAt: string;
  company: string;
  position: string;
  jobSource: JobSource;
  jobDescription: string | null;
  jobAnalysis: JobAnalysis;
  recruiterName: string | null;
  recruiterEmail: string | null;
  emailSubject: string;
  emailBody: string;
  status: ApplicationStatus;
  sentAt: string | null;
  errorMessage: string | null;
  sendStartedAt: string | null;
  conversationId: string | null;
  replyFrom: string | null;
  replyPreview: string | null;
  replyReceivedAt: string | null;
};

const draftSchema = z.object({
  company: z.string().trim().min(1).max(160),
  position: z.string().trim().min(1).max(160),
  recruiterName: z.union([z.string().trim().max(120), z.null()]),
  recruiterEmail: z.union([z.string().trim().email().max(320), z.null()]),
  emailSubject: z.string().trim().min(1).max(200),
  emailBody: z.string().trim().min(1).max(8000),
});

export type ApplicationDraft = z.infer<typeof draftSchema>;

type ApplicationRow = {
  id: string;
  created_at: string;
  company: string;
  position: string;
  job_source: JobSource;
  job_description: string | null;
  job_analysis: unknown;
  recruiter_name: string | null;
  recruiter_email: string | null;
  email_subject: string;
  email_body: string;
  status: ApplicationStatus;
  sent_at: string | null;
  error_message: string | null;
  send_started_at: string | null;
  conversation_id: string | null;
  reply_from: string | null;
  reply_preview: string | null;
  reply_received_at: string | null;
};

function fromRow(row: ApplicationRow): ApplicationRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    company: row.company,
    position: row.position,
    jobSource: row.job_source,
    jobDescription: row.job_description,
    jobAnalysis: jobAnalysisSchema.parse(row.job_analysis),
    recruiterName: row.recruiter_name,
    recruiterEmail: row.recruiter_email,
    emailSubject: row.email_subject,
    emailBody: row.email_body,
    status: row.status,
    sentAt: row.sent_at,
    errorMessage: row.error_message,
    sendStartedAt: row.send_started_at,
    conversationId: row.conversation_id ?? null,
    replyFrom: row.reply_from ?? null,
    replyPreview: row.reply_preview ?? null,
    replyReceivedAt: row.reply_received_at ?? null,
  };
}

const baseColumns =
  "id, created_at, company, position, job_source, job_description, job_analysis, recruiter_name, recruiter_email, email_subject, email_body, status, sent_at, error_message, send_started_at";
const columns = `${baseColumns}, conversation_id, reply_from, reply_preview, reply_received_at`;

export async function createDraft(input: {
  analysis: JobAnalysis;
  source: Exclude<JobSource, "url">;
  jobDescription: string;
}) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("applications")
    .insert({
      company: input.analysis.company,
      position: input.analysis.position,
      job_source: input.source,
      job_description: input.jobDescription,
      job_analysis: input.analysis,
      recruiter_name: input.analysis.recruiterName,
      recruiter_email: input.analysis.recruiterEmail,
      email_subject: input.analysis.application.subject,
      email_body: input.analysis.application.body,
      status: "draft",
    })
    .select(baseColumns)
    .single();

  if (error || !data) throw new AppError("The application could not be saved.", 502, "application_save_failed");
  return fromRow(data as ApplicationRow);
}

export async function listApplications() {
  const supabase = getSupabase();
  const listed = await supabase
    .from("applications")
    .select("id, created_at, company, position, status, reply_from, reply_received_at")
    .order("created_at", { ascending: false })
    .limit(100);
  const fallback = replyColumnMissing(listed.error)
    ? await supabase
        .from("applications")
        .select("id, created_at, company, position, status")
        .order("created_at", { ascending: false })
        .limit(100)
    : listed;
  if (fallback.error) throw new AppError("Applications could not be loaded.", 502, "applications_read_failed");
  return (fallback.data ?? []).map((row) => ({
    id: row.id as string,
    created_at: row.created_at as string,
    company: row.company as string,
    position: row.position as string,
    status: row.status as ApplicationStatus,
    reply_from: "reply_from" in row ? ((row.reply_from as string | null) ?? null) : null,
    reply_received_at:
      "reply_received_at" in row ? ((row.reply_received_at as string | null) ?? null) : null,
  }));
}

export async function deleteApplication(id: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("applications").delete().eq("id", id).select("id").maybeSingle();
  if (error) throw new AppError("The application could not be deleted.", 502, "application_delete_failed");
  if (!data) throw new AppError("Application not found.", 404, "not_found");
}

export async function getApplication(id: string) {
  const supabase = getSupabase();
  const first = await supabase.from("applications").select(columns).eq("id", id).maybeSingle();
  const result = replyColumnMissing(first.error)
    ? await supabase.from("applications").select(baseColumns).eq("id", id).maybeSingle()
    : first;
  if (result.error) throw new AppError("The application could not be loaded.", 502, "application_read_failed");
  if (!result.data) return null;
  try {
    return fromRow(result.data as ApplicationRow);
  } catch {
    throw new AppError("The saved application is invalid.", 500, "application_invalid");
  }
}

export function parseDraft(input: unknown) {
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("Check the recipient, subject, and email before continuing.", 422, "invalid_application");
  }
  return parsed.data;
}

export function parseSend(input: unknown) {
  const parsed = draftSchema.safeParse({
    ...(typeof input === "object" && input !== null ? input : {}),
    recruiterEmail:
      typeof input === "object" && input !== null && "recruiterEmail" in input
        ? (input.recruiterEmail ?? null)
        : null,
  });
  if (!parsed.success || !parsed.data.recruiterEmail) {
    const emailProblem =
      !parsed.success && parsed.error.issues.some((issue) => issue.path.includes("recruiterEmail"));
    throw new AppError(
      emailProblem || parsed.success
        ? "Enter a valid recipient email."
        : "Check the subject and email before sending.",
      422,
      "invalid_email",
    );
  }
  return { ...parsed.data, recruiterEmail: parsed.data.recruiterEmail };
}

async function updateEditable(id: string, draft: ApplicationDraft, statusFilter: string[]) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("applications")
    .update({
      company: draft.company,
      position: draft.position,
      recruiter_name: draft.recruiterName,
      recruiter_email: draft.recruiterEmail,
      email_subject: draft.emailSubject,
      email_body: draft.emailBody,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .in("status", statusFilter)
    .select("id")
    .maybeSingle();
  if (error) throw new AppError("The application could not be saved.", 502, "application_save_failed");
  return Boolean(data);
}

export async function updateDraft(id: string, draft: ApplicationDraft) {
  const saved = await updateEditable(id, draft, ["draft", "ready", "failed"]);
  if (!saved) throw new AppError("Sent applications cannot be edited.", 409, "already_sent");
}

export async function lockForSend(id: string, draft: ApplicationDraft) {
  const supabase = getSupabase();
  const patch = {
    company: draft.company,
    position: draft.position,
    recruiter_name: draft.recruiterName,
    recruiter_email: draft.recruiterEmail,
    email_subject: draft.emailSubject,
    email_body: draft.emailBody,
    status: "ready",
    send_started_at: new Date().toISOString(),
    error_message: null,
    updated_at: new Date().toISOString(),
  };
  const first = await supabase
    .from("applications")
    .update(patch)
    .eq("id", id)
    .in("status", ["draft", "failed"])
    .select("id")
    .maybeSingle();
  if (first.error) throw new AppError("The application could not be sent.", 502, "application_save_failed");
  if (first.data) return true;

  const staleBefore = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const second = await supabase
    .from("applications")
    .update(patch)
    .eq("id", id)
    .eq("status", "ready")
    .lt("send_started_at", staleBefore)
    .select("id")
    .maybeSingle();
  if (second.error) throw new AppError("The application could not be sent.", 502, "application_save_failed");
  return Boolean(second.data);
}

export async function markSent(id: string) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("applications")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new AppError("history_update_failed", 502, "history_update_failed");
}

function replyColumnMissing(error: { message?: string; code?: string } | null) {
  const message = error?.message ?? "";
  return error?.code === "PGRST204" || /conversation_id|reply_from|reply_preview|reply_received_at/.test(message);
}

export async function saveConversationId(id: string, conversationId: string) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("applications")
    .update({ conversation_id: conversationId, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (replyColumnMissing(error)) {
    throw new AppError("Run the replies migration in Supabase, then try again.", 503, "replies_not_ready");
  }
  if (error) throw new AppError("The reply check could not be saved.", 502, "reply_save_failed");
}

export async function saveReply(
  id: string,
  reply: { from: string; preview: string; receivedAt: string } | null,
) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("applications")
    .update({
      reply_from: reply?.from ?? null,
      reply_preview: reply?.preview ?? null,
      reply_received_at: reply?.receivedAt ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (replyColumnMissing(error)) {
    throw new AppError("Run the replies migration in Supabase, then try again.", 503, "replies_not_ready");
  }
  if (error) throw new AppError("The reply check could not be saved.", 502, "reply_save_failed");
}

export async function markFailed(id: string, message: string) {
  const supabase = getSupabase();
  await supabase
    .from("applications")
    .update({
      status: "failed",
      error_message: message.slice(0, 300),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .neq("status", "sent");
}
