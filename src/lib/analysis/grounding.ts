import type { JobAnalysis } from "@/lib/analysis/schema";
import type { CandidateProfile } from "@/lib/profile/schema";

const BANNED = [
  "i am thrilled",
  "i'm thrilled",
  "i am passionate",
  "i'm passionate",
  "i am excited",
  "i'm excited",
  "unique combination",
  "i believe i would be a great fit",
];

const ACHIEVEMENT = ["led", "managed", "increased", "reduced", "architected", "launched", "mentored", "scaled"];

const COMMON_TECHS = [
  "rxjs",
  "vue",
  "vue.js",
  "svelte",
  "django",
  "python",
  "java",
  "kotlin",
  "swift",
  "flutter",
  "docker",
  "kubernetes",
  "terraform",
  "redis",
  "mongodb",
  "mysql",
  "kafka",
  "ruby",
  "rails",
  "php",
  "laravel",
  "golang",
  "rust",
  "c#",
  ".net",
  "spring",
  "redux",
  "webpack",
  "playwright",
  "selenium",
  "firebase",
  "dynamodb",
  "elasticsearch",
  "node.js",
  "nodejs",
  "express",
  "html",
  "css",
  "sass",
  "figma",
  "azure",
  "gcp",
  "oracle",
  "jenkins",
];

const CLAIM_TAIL = "((?:[^.\\n!]|\\.(?!\\s)){1,160})";

const PRIMARY_STEM =
  `(?:working primarily with|primarily with|working with|worked with|experience with|experienced with|experienced in|background in|proficient in|skilled in|hands-on with|expertise in|i use|i've used|i have used|i know)\\s+${CLAIM_TAIL}`;

const FAMILIAR_STEM = `(?:familiar with|familiarity with|some exposure to)\\s+${CLAIM_TAIL}`;

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function blank(value: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function clip(value: string, max: number) {
  const trimmed = value.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mentions(text: string, token: string) {
  return new RegExp(`(?:^|[^a-z0-9+#])${escapeRegExp(token)}(?:$|[^a-z0-9+#])`, "i").test(text);
}

export function matchSkill(name: string, profile: CandidateProfile) {
  const target = normalize(name);
  const skills = [...profile.skills].sort((a, b) => b.name.length - a.name.length);
  return (
    skills.find((skill) => normalize(skill.name) === target) ??
    skills.find((skill) => target.includes(normalize(skill.name)))
  );
}

function matchCompany(name: string, profile: CandidateProfile) {
  const target = normalize(name);
  if (target.length < 3) return undefined;
  return profile.experiences.find((experience) => {
    const company = normalize(experience.company);
    return company === target || company.includes(target) || target.includes(company);
  });
}

function profileCorpus(profile: CandidateProfile) {
  return normalize(
    [
      profile.headline,
      profile.summary,
      ...profile.experiences.flatMap((experience) => [
        experience.company,
        experience.title ?? "",
        ...experience.highlights,
      ]),
      ...profile.education.flatMap((item) => [item.institution, item.degree]),
      ...profile.skills.flatMap((skill) => [skill.name, skill.notes ?? ""]),
    ].join(" "),
  );
}

function fragments(phrase: string) {
  return phrase
    .split(/,|&| and /i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function emailsIn(text: string) {
  return [...text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map((match) =>
    match[0].toLowerCase(),
  );
}

function sentenceSkipsClaim(sentence: string) {
  return /\b(not|no|haven't|have not|don't|do not|without|haven't)\b/i.test(sentence);
}

export function findBodyViolations(body: string, profile: CandidateProfile, recruiterName: string | null) {
  const violations: string[] = [];
  const lower = body.toLowerCase();
  for (const phrase of BANNED) {
    if (lower.includes(phrase)) violations.push(`Remove the phrase "${phrase}".`);
  }
  if (/\b\d+\+?\s+years\b/i.test(body)) {
    violations.push("Do not claim a number of years. That is not on the profile.");
  }

  const corpus = profileCorpus(profile);
  for (const verb of ACHIEVEMENT) {
    if (new RegExp(`\\b${verb}\\b`, "i").test(body) && !corpus.includes(verb)) {
      violations.push(`Do not claim "${verb}". That is not on the profile.`);
    }
  }

  const firstLine = body.trim().split("\n")[0] ?? "";
  if (!recruiterName && /^hi\s+[a-z]/i.test(firstLine) && !/^hi\s*,/i.test(firstLine)) {
    violations.push("The greeting uses a name that is not in the posting.");
  }

  const sentences = body.split(/\n+|(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    if (sentenceSkipsClaim(sentence)) continue;
    const primary = [...sentence.matchAll(new RegExp(PRIMARY_STEM, "gi"))];
    for (const match of primary) {
      for (const fragment of fragments(match[1] ?? "")) {
        const skill = [...profile.skills]
          .sort((a, b) => b.name.length - a.name.length)
          .find((item) => mentions(fragment, item.name));
        if (skill?.level === "basic") {
          violations.push(`Do not present ${skill.name} as core experience. It is basic familiarity.`);
        }
        for (const tech of COMMON_TECHS) {
          const owned = profile.skills.some((item) => mentions(item.name, tech) || mentions(tech, item.name));
          if (!owned && mentions(fragment, tech)) {
            violations.push(`Do not claim ${tech}. It is not on the profile.`);
          }
        }
      }
    }
    for (const match of sentence.matchAll(new RegExp(FAMILIAR_STEM, "gi"))) {
      for (const fragment of fragments(match[1] ?? "")) {
        for (const tech of COMMON_TECHS) {
          const owned = profile.skills.some((item) => mentions(item.name, tech) || mentions(tech, item.name));
          if (!owned && mentions(fragment, tech)) {
            violations.push(`Do not claim ${tech}. It is not on the profile.`);
          }
        }
      }
    }
  }

  return [...new Set(violations)];
}

export function reviewAnalysis(
  raw: JobAnalysis,
  profile: CandidateProfile,
  sourceText: string,
): { analysis: JobAnalysis; bodyViolations: string[] } {
  const strengths: JobAnalysis["match"]["strengths"] = [];
  const dropped: string[] = [];
  for (const strength of raw.match.strengths) {
    const skill = matchSkill(strength.skillName, profile);
    if (!skill) {
      if (strength.skillName.trim()) dropped.push(strength.skillName.trim());
      continue;
    }
    if (strengths.some((item) => normalize(item.skillName) === normalize(skill.name))) continue;
    strengths.push({
      skillName: skill.name,
      reason: skill.level === "basic" ? "Basic familiarity on your profile." : "On your profile.",
    });
  }

  const relevantExperience: JobAnalysis["match"]["relevantExperience"] = [];
  for (const item of raw.match.relevantExperience) {
    const experience = matchCompany(item.company, profile);
    if (!experience) continue;
    if (relevantExperience.some((entry) => entry.company === experience.company)) continue;
    const detail = experience.highlights[0]?.trim();
    relevantExperience.push({
      company: experience.company,
      reason: experience.title?.trim() || detail || "Listed on your profile.",
    });
  }

  const gaps: JobAnalysis["match"]["gaps"] = [];
  for (const gap of raw.match.gaps) {
    const label = clip(gap.label, 120);
    if (!label) continue;
    const skill = matchSkill(label, profile);
    if (skill?.level === "proficient") continue;
    if (gaps.some((item) => normalize(item.label) === normalize(label))) continue;
    gaps.push({ label, detail: clip(gap.detail, 240) });
  }
  for (const label of dropped) {
    if (gaps.some((item) => normalize(item.label) === normalize(label))) continue;
    gaps.push({ label: clip(label, 120), detail: "Not on your profile." });
  }

  const transcript = clip(raw.transcript, 20_000);
  const evidence = sourceText || transcript;
  const knownEmails = emailsIn(evidence);
  const recruiterEmailRaw = blank(raw.recruiterEmail);
  const recruiterEmail =
    recruiterEmailRaw && knownEmails.includes(recruiterEmailRaw.toLowerCase())
      ? recruiterEmailRaw
      : null;
  const recruiterNameRaw = blank(raw.recruiterName);
  const recruiterName =
    recruiterNameRaw &&
    recruiterNameRaw.length >= 3 &&
    evidence.toLowerCase().includes(recruiterNameRaw.toLowerCase())
      ? recruiterNameRaw
      : null;

  const position = clip(raw.position, 160);
  const company = clip(raw.company, 160);
  const body = clip(raw.application.body, 8000);
  const analysis: JobAnalysis = {
    ...raw,
    company,
    position,
    recruiterName,
    recruiterEmail,
    location: blank(raw.location) ? clip(raw.location ?? "", 160) : null,
    employmentType: blank(raw.employmentType) ? clip(raw.employmentType ?? "", 80) : null,
    seniority: blank(raw.seniority) ? clip(raw.seniority ?? "", 80) : null,
    language: blank(raw.language) ? clip(raw.language ?? "", 40) : null,
    summary: clip(raw.summary, 2000),
    transcript,
    requirements: raw.requirements.map((item) => clip(item, 300)).filter(Boolean).slice(0, 40),
    niceToHave: raw.niceToHave.map((item) => clip(item, 300)).filter(Boolean).slice(0, 40),
    technologies: raw.technologies.map((item) => clip(item, 80)).filter(Boolean).slice(0, 40),
    match: { strengths, relevantExperience, gaps },
    application: {
      subject: position
        ? `Application | ${position} | ${profile.personalInfo.fullName}`
        : clip(raw.application.subject, 200),
      body,
    },
  };

  return {
    analysis,
    bodyViolations: analysis.unreadable ? [] : findBodyViolations(body, profile, recruiterName),
  };
}
