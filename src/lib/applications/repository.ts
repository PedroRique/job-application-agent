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
  };
}

const columns =
  "id, created_at, company, position, job_source, job_description, job_analysis, recruiter_name, recruiter_email, email_subject, email_body, status, sent_at, error_message, send_started_at";

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
    .select(columns)
    .single();

  if (error || !data) throw new AppError("The application could not be saved.", 502, "application_save_failed");
  return fromRow(data as ApplicationRow);
}

export async function listApplications() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("applications")
    .select("id, created_at, company, position, status")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new AppError("Applications could not be loaded.", 502, "applications_read_failed");
  return (data ?? []) as {
    id: string;
    created_at: string;
    company: string;
    position: string;
    status: ApplicationStatus;
  }[];
}

export async function getApplication(id: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("applications").select(columns).eq("id", id).maybeSingle();
  if (error) throw new AppError("The application could not be loaded.", 502, "application_read_failed");
  if (!data) return null;
  try {
    return fromRow(data as ApplicationRow);
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
