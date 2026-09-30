import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { jobAnalysisSchema, type JobAnalysis } from "@/lib/analysis/schema";
import { systemPrompt } from "@/lib/analysis/prompt";
import { reviewAnalysis } from "@/lib/analysis/grounding";
import { AppError } from "@/lib/errors";
import type { CandidateProfile } from "@/lib/profile/schema";

type AnalyzeInput = {
  profile: CandidateProfile;
  source: "text" | "screenshot";
  text?: string;
  image?: { mime: string; base64: string };
};

function userContent(input: AnalyzeInput, feedback: string[]) {
  const correction =
    feedback.length > 0
      ? `\n\nThe previous draft was rejected. Rewrite the email without these claims:\n${feedback
          .map((item) => `- ${item}`)
          .join("\n")}`
      : "";
  const instructions = `CandidateProfile JSON is the only source of professional facts:\n${JSON.stringify(input.profile)}\n\nExtract the job and draft the email.${correction}`;

  if (input.source === "screenshot" && input.image) {
    return [
      { type: "input_text" as const, text: instructions },
      {
        type: "input_image" as const,
        image_url: `data:${input.image.mime};base64,${input.image.base64}`,
        detail: "high" as const,
      },
    ];
  }

  return `${instructions}\n\nJob posting:\n${input.text ?? ""}`;
}

export async function analyzeJob(input: AnalyzeInput): Promise<JobAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AppError("OpenAI is not configured.", 503, "openai_not_configured");

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-5.5";
  let feedback: string[] = [];
  let last: JobAnalysis | null = null;

  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await client.responses.parse({
        model,
        store: false,
        max_output_tokens: 5000,
        input: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent(input, feedback) },
        ],
        text: { format: zodTextFormat(jobAnalysisSchema, "job_analysis") },
      });

      if (!response.output_parsed) {
        throw new AppError("The job could not be analyzed. Try again in a moment.", 502, "openai_failed");
      }

      const parsed = jobAnalysisSchema.parse(response.output_parsed);
      const sourceText = input.source === "text" ? (input.text ?? "") : parsed.transcript;
      const reviewed = reviewAnalysis(parsed, input.profile, sourceText);
      last = reviewed.analysis;
      if (reviewed.analysis.unreadable || reviewed.bodyViolations.length === 0) {
        return reviewed.analysis;
      }
      feedback = reviewed.bodyViolations;
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof OpenAI.APIError) {
      console.error("openai", error.status, error.code ?? error.type);
    } else {
      console.error("openai_failed");
    }
    throw new AppError("The job could not be analyzed. Try again in a moment.", 502, "openai_failed");
  }

  if (last?.unreadable) return last;
  throw new AppError(
    "The draft mentioned experience that is not on your profile. Try again.",
    422,
    "ungrounded",
  );
}
