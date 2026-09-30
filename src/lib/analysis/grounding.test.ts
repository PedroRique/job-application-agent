import assert from "node:assert/strict";
import test from "node:test";
import { zodTextFormat } from "openai/helpers/zod";
import { jobAnalysisSchema, type JobAnalysis } from "./schema";
import { findBodyViolations, reviewAnalysis } from "./grounding";
import { systemPrompt } from "./prompt";
import { candidateProfileSchema } from "../profile/schema";
import { seedProfile } from "../profile/seed";

const profile = candidateProfileSchema.parse(seedProfile);

function analysis(body: string, extras?: Partial<JobAnalysis>): JobAnalysis {
  return {
    unreadable: false,
    unreadableReason: null,
    company: "Acme",
    position: "Senior Frontend Engineer",
    recruiterName: null,
    recruiterEmail: null,
    location: null,
    workMode: "remote",
    employmentType: null,
    seniority: "senior",
    requirements: ["Angular"],
    niceToHave: [],
    technologies: ["Angular", "RxJS"],
    language: "English",
    summary: "Frontend role.",
    transcript: "Senior Frontend Engineer at Acme. Angular and RxJS.",
    match: {
      strengths: [
        { skillName: "Angular", reason: "model text" },
        { skillName: "RxJS", reason: "invented" },
      ],
      relevantExperience: [
        { company: "Google", reason: "invented" },
        { company: "BairesDev / Intros Matter", reason: "invented duties" },
      ],
      gaps: [{ label: "RxJS", detail: "Required by the role." }],
    },
    application: {
      subject: "Hello",
      body,
    },
    ...extras,
  };
}

const groundedBody = `Hi,

I came across the Senior Frontend Engineer position at Acme and wanted to reach out.

I've been working primarily with Angular, TypeScript and GraphQL, which seems closely aligned with what you're looking for.

My background includes BairesDev / Intros Matter.

Best,
Pedro Rique`;

test("seed profile matches the schema", () => {
  assert.equal(candidateProfileSchema.parse(seedProfile).personalInfo.fullName, "Pedro Rique");
});

test("structured output schema converts", () => {
  const format = zodTextFormat(jobAnalysisSchema, "job_analysis");
  assert.equal(format.name, "job_analysis");
});

test("prompt forbids invented experience", () => {
  assert.match(systemPrompt, /Never invent/);
});

test("keeps profile facts and drops invented skills and companies", () => {
  const reviewed = reviewAnalysis(analysis(groundedBody), profile, analysis(groundedBody).transcript);
  assert.deepEqual(
    reviewed.analysis.match.strengths.map((item) => item.skillName),
    ["Angular"],
  );
  assert.equal(reviewed.analysis.match.relevantExperience.length, 1);
  assert.equal(reviewed.analysis.match.relevantExperience[0]?.company, "BairesDev / Intros Matter");
  assert.equal(reviewed.analysis.match.relevantExperience[0]?.reason, "Listed on your profile.");
  assert.ok(reviewed.analysis.match.gaps.some((gap) => gap.label === "RxJS"));
  assert.equal(
    reviewed.analysis.application.subject,
    "Application | Senior Frontend Engineer | Pedro Rique",
  );
  assert.deepEqual(reviewed.bodyViolations, []);
});

test("rejects banned phrasing, years, invented tech, and basic skills as core experience", () => {
  assert.ok(findBodyViolations("I am thrilled to apply.", profile, null).length > 0);
  assert.ok(findBodyViolations("I have 8 years of experience.", profile, null).length > 0);
  assert.ok(findBodyViolations("I led the frontend migration.", profile, null).length > 0);
  assert.ok(
    findBodyViolations("I've been working primarily with Angular and RxJS.", profile, null).some(
      (item) => item.includes("rxjs"),
    ),
  );
  assert.ok(
    findBodyViolations("I've been working primarily with Next.js.", profile, null).some((item) =>
      item.includes("Next.js"),
    ),
  );
  assert.deepEqual(
    findBodyViolations("I have some familiarity with Next.js.", profile, null),
    [],
  );
});

test("drops a recruiter email that is not in the source text", () => {
  const reviewed = reviewAnalysis(
    analysis(groundedBody, { recruiterEmail: "sarah@acme.com", recruiterName: "Sarah" }),
    profile,
    "Senior Frontend Engineer at Acme",
  );
  assert.equal(reviewed.analysis.recruiterEmail, null);
  assert.equal(reviewed.analysis.recruiterName, null);
});
