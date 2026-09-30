import { z } from "zod";

export const jobSources = ["text", "screenshot", "url"] as const;
export const applicationStatuses = ["draft", "ready", "sent", "failed"] as const;

export const jobAnalysisSchema = z.object({
  unreadable: z.boolean(),
  unreadableReason: z.string().nullable(),
  company: z.string(),
  position: z.string(),
  recruiterName: z.string().nullable(),
  recruiterEmail: z.string().nullable(),
  location: z.string().nullable(),
  workMode: z.enum(["remote", "hybrid", "on-site", "unknown"]),
  employmentType: z.string().nullable(),
  seniority: z.string().nullable(),
  requirements: z.array(z.string()),
  niceToHave: z.array(z.string()),
  technologies: z.array(z.string()),
  language: z.string().nullable(),
  summary: z.string(),
  transcript: z.string(),
  match: z.object({
    strengths: z.array(
      z.object({
        skillName: z.string(),
        reason: z.string(),
      }),
    ),
    relevantExperience: z.array(
      z.object({
        company: z.string(),
        reason: z.string(),
      }),
    ),
    gaps: z.array(
      z.object({
        label: z.string(),
        detail: z.string(),
      }),
    ),
  }),
  application: z.object({
    subject: z.string(),
    body: z.string(),
  }),
});

export type JobAnalysis = z.infer<typeof jobAnalysisSchema>;
export type JobSource = (typeof jobSources)[number];
export type ApplicationStatus = (typeof applicationStatuses)[number];
