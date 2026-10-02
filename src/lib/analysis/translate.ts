import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { findBodyViolations } from "@/lib/analysis/grounding";
import { AppError } from "@/lib/errors";
import type { CandidateProfile } from "@/lib/profile/schema";

const translationSchema = z.object({
  body: z.string(),
});

const instructions = `Translate the application email body. Keep every fact already in the text.
Do not add employers, titles, dates, achievements, technologies, education, or spoken languages.
Do not add a number of years. Do not use "I am thrilled", "I am passionate", "I am excited", "unique combination", or "I believe I would be a great fit".
Portuguese closes with "Atenciosamente," and the name already in the text.
English closes with "Best," and the name already in the text.`;

export async function translateEmailBody(
  body: string,
  language: "pt" | "en",
  profile: CandidateProfile,
  recruiterName: string | null,
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AppError("OpenAI is not configured.", 503, "openai_not_configured");

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-5.5";
  const target = language === "pt" ? "Portuguese" : "English";

  let translated: string;
  try {
    const response = await client.responses.parse({
      model,
      store: false,
      max_output_tokens: 8000,
      reasoning: { effort: "low" },
      input: [
        { role: "system", content: instructions },
        { role: "user", content: `Translate this email body into ${target}:\n\n${body}` },
      ],
      text: { format: zodTextFormat(translationSchema, "email_translation") },
    });
    if (!response.output_parsed?.body.trim()) {
      throw new AppError("The email could not be translated. Try again.", 502, "openai_failed");
    }
    translated = response.output_parsed.body.trim();
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("openai_translate", error instanceof OpenAI.APIError ? error.status : "failed");
    throw new AppError("The email could not be translated. Try again.", 502, "openai_failed");
  }

  const violations = findBodyViolations(translated, profile, recruiterName);
  if (violations.length > 0) {
    throw new AppError(
      "The translation mentioned experience that is not on your profile. The original text was kept.",
      422,
      "ungrounded",
    );
  }
  return translated;
}
