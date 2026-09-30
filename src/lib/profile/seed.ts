import type { CandidateProfile } from "@/lib/profile/schema";

const proficient = [
  "Angular",
  "React",
  "React Native",
  "Expo",
  "Ionic",
  "TypeScript",
  "JavaScript",
  "GraphQL",
  "ngrx",
  "Tailwind",
  "i18next",
  "Cypress",
  "Jest",
  "Detox",
  "Vite",
  "shadcn/ui",
  "WebRTC",
  "GA4",
  "GTM",
  "Supabase",
] as const;

const basic = ["NestJS", "Next.js", "Nuxt", "PostgreSQL", "AWS"] as const;

const companies = [
  "BairesDev / Intros Matter",
  "Thomson Reuters via ACT Digital",
  "Maven Clinic",
  "ZS Associates",
  "Tidal",
  "PatientNow",
  "Luminator",
  "Nayax/VendSys",
] as const;

// Only facts that were explicitly provided. Titles, dates, and highlights stay empty.
export const seedProfile: CandidateProfile = {
  personalInfo: {
    fullName: "Pedro Rique",
    email: null,
    phone: null,
    location: null,
    links: [],
  },
  headline: "Senior Front-end Developer",
  summary: "",
  education: [
    { institution: "UERJ", degree: "Ciência da Computação", year: null },
    { institution: "IBMR", degree: "Pós-graduação em Inteligência Artificial", year: null },
  ],
  experiences: companies.map((company) => ({
    company,
    title: null,
    start: null,
    end: null,
    highlights: [],
  })),
  skills: [
    ...proficient.map((name) => ({
      name,
      level: "proficient" as const,
      notes: name === "Angular" ? "14–19" : null,
    })),
    ...basic.map((name) => ({
      name,
      level: "basic" as const,
      notes: null,
    })),
  ],
  languages: [],
};
