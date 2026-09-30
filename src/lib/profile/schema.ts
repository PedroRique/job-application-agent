import { z } from "zod";

export const skillLevels = ["proficient", "basic"] as const;

const optionalText = (max: number) => z.union([z.string().trim().min(1).max(max), z.null()]);

export const candidateProfileSchema = z.object({
  personalInfo: z.object({
    fullName: z.string().trim().min(1).max(120),
    email: z.union([z.string().trim().email().max(320), z.null()]),
    phone: optionalText(40),
    location: optionalText(120),
    links: z
      .array(
        z.object({
          label: z.string().trim().min(1).max(40),
          url: z.string().trim().url().max(300),
        }),
      )
      .max(10),
  }),
  headline: z.string().trim().min(1).max(160),
  summary: z.string().trim().max(4000),
  education: z
    .array(
      z.object({
        institution: z.string().trim().min(1).max(160),
        degree: z.string().trim().min(1).max(200),
        year: optionalText(20),
      }),
    )
    .max(20),
  experiences: z
    .array(
      z.object({
        company: z.string().trim().min(1).max(160),
        title: optionalText(160),
        start: optionalText(40),
        end: optionalText(40),
        highlights: z.array(z.string().trim().min(1).max(500)).max(20),
      }),
    )
    .max(40),
  skills: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        level: z.enum(skillLevels),
        notes: optionalText(200),
      }),
    )
    .max(80),
  languages: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(40),
        level: optionalText(40),
      }),
    )
    .max(20),
});

export type CandidateProfile = z.infer<typeof candidateProfileSchema>;
export type SkillLevel = (typeof skillLevels)[number];
