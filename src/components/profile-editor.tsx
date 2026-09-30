"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CandidateProfile } from "@/lib/profile/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ExperienceDraft = {
  company: string;
  title: string;
  start: string;
  end: string;
  highlightsText: string;
};

type Draft = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  headline: string;
  summary: string;
  education: { institution: string; degree: string; year: string }[];
  experiences: ExperienceDraft[];
  skills: { name: string; level: "proficient" | "basic"; notes: string }[];
  languages: { name: string; level: string }[];
};

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toDraft(profile: CandidateProfile): Draft {
  return {
    fullName: profile.personalInfo.fullName,
    email: profile.personalInfo.email ?? "",
    phone: profile.personalInfo.phone ?? "",
    location: profile.personalInfo.location ?? "",
    headline: profile.headline,
    summary: profile.summary,
    education: profile.education.map((item) => ({
      institution: item.institution,
      degree: item.degree,
      year: item.year ?? "",
    })),
    experiences: profile.experiences.map((item) => ({
      company: item.company,
      title: item.title ?? "",
      start: item.start ?? "",
      end: item.end ?? "",
      highlightsText: item.highlights.join("\n"),
    })),
    skills: profile.skills.map((item) => ({
      name: item.name,
      level: item.level,
      notes: item.notes ?? "",
    })),
    languages: profile.languages.map((item) => ({
      name: item.name,
      level: item.level ?? "",
    })),
  };
}

function toProfile(draft: Draft, links: CandidateProfile["personalInfo"]["links"]): CandidateProfile {
  return {
    personalInfo: {
      fullName: draft.fullName.trim(),
      email: emptyToNull(draft.email),
      phone: emptyToNull(draft.phone),
      location: emptyToNull(draft.location),
      links,
    },
    headline: draft.headline.trim(),
    summary: draft.summary.trim(),
    education: draft.education
      .filter((item) => item.institution.trim() && item.degree.trim())
      .map((item) => ({
        institution: item.institution.trim(),
        degree: item.degree.trim(),
        year: emptyToNull(item.year),
      })),
    experiences: draft.experiences
      .filter((item) => item.company.trim())
      .map((item) => ({
        company: item.company.trim(),
        title: emptyToNull(item.title),
        start: emptyToNull(item.start),
        end: emptyToNull(item.end),
        highlights: item.highlightsText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      })),
    skills: draft.skills
      .filter((item) => item.name.trim())
      .map((item) => ({
        name: item.name.trim(),
        level: item.level,
        notes: emptyToNull(item.notes),
      })),
    languages: draft.languages
      .filter((item) => item.name.trim())
      .map((item) => ({
        name: item.name.trim(),
        level: emptyToNull(item.level),
      })),
  };
}

export function ProfileEditor({
  profile,
  resumeFileName,
  outlookConnected,
  outlookEmail,
  microsoftConfigured,
  notice,
}: {
  profile: CandidateProfile;
  resumeFileName: string | null;
  outlookConnected: boolean;
  outlookEmail: string | null;
  microsoftConfigured: boolean;
  notice: string | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => toDraft(profile));
  const [message, setMessage] = useState(notice ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toProfile(draft, profile.personalInfo.links)),
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setPending(false);
    if (!response.ok) {
      setError(body?.error ?? "The profile could not be saved.");
      return;
    }
    setMessage("Profile saved.");
  }

  async function uploadResume(file: File | undefined) {
    if (!file) return;
    setError("");
    setMessage("");
    const form = new FormData();
    form.set("resume", file);
    const response = await fetch("/api/resume", { method: "POST", body: form });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setError(body?.error ?? "The resume could not be stored.");
      return;
    }
    setMessage("Resume saved.");
    router.refresh();
  }

  async function disconnect() {
    const response = await fetch("/api/microsoft/disconnect", { method: "POST" });
    if (!response.ok) {
      setError("Outlook could not be disconnected.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-heading text-2xl">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Only facts saved here can appear in an application. Empty experience details stay empty.
        </p>
      </div>
      {message ? <p className="text-sm">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <section className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="font-medium">Resume</h2>
        <p className="text-sm">{resumeFileName ? `✓ ${resumeFileName}` : "Resume is not configured."}</p>
        <label className="text-sm">
          <span className="sr-only">Upload PDF resume</span>
          <input
            type="file"
            accept="application/pdf"
            className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2"
            onChange={(event) => void uploadResume(event.target.files?.[0])}
          />
        </label>
      </section>

      <section className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="font-medium">Outlook</h2>
        {!microsoftConfigured ? (
          <p className="text-sm">Microsoft sign-in is not configured.</p>
        ) : outlookConnected ? (
          <>
            <p className="text-sm">Connected{outlookEmail ? ` as ${outlookEmail}` : ""}.</p>
            <Button type="button" variant="outline" className="h-11" onClick={() => void disconnect()}>
              Disconnect Outlook
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm">Outlook not connected</p>
            <Button asChild className="h-11">
              <a href="/api/microsoft/start">Connect Outlook</a>
            </Button>
          </>
        )}
      </section>

      <form onSubmit={save} className="grid gap-5">
        <div className="grid gap-3">
          <Label htmlFor="fullName">Name</Label>
          <Input id="fullName" value={draft.fullName} onChange={(event) => setDraft({ ...draft, fullName: event.target.value })} className="h-11 text-base" required />
          <Label htmlFor="headline">Headline</Label>
          <Input id="headline" value={draft.headline} onChange={(event) => setDraft({ ...draft, headline: event.target.value })} className="h-11 text-base" required />
          <Label htmlFor="email">Email on profile</Label>
          <Input id="email" type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} className="h-11 text-base" />
          <Label htmlFor="location">Location</Label>
          <Input id="location" value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} className="h-11 text-base" />
          <Label htmlFor="summary">Summary</Label>
          <Textarea id="summary" value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} className="min-h-28 text-base" />
        </div>

        <fieldset className="grid gap-3">
          <legend className="font-medium">Education</legend>
          {draft.education.map((item, index) => (
            <div key={index} className="grid gap-2">
              <Input value={item.degree} aria-label="Degree" onChange={(event) => updateEducation(index, { degree: event.target.value })} className="h-11 text-base" />
              <Input value={item.institution} aria-label="Institution" onChange={(event) => updateEducation(index, { institution: event.target.value })} className="h-11 text-base" />
            </div>
          ))}
          <Button type="button" variant="outline" className="h-11" onClick={() => setDraft({ ...draft, education: [...draft.education, { institution: "", degree: "", year: "" }] })}>
            Add education
          </Button>
        </fieldset>

        <fieldset className="grid gap-3">
          <legend className="font-medium">Experience</legend>
          {draft.experiences.map((item, index) => (
            <div key={index} className="grid gap-2 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
              <Input value={item.company} aria-label="Company" onChange={(event) => updateExperience(index, { company: event.target.value })} className="h-11 text-base" />
              <Input value={item.title} aria-label="Title" placeholder="Title, if you want it stated" onChange={(event) => updateExperience(index, { title: event.target.value })} className="h-11 text-base" />
              <Textarea value={item.highlightsText} aria-label="Highlights" placeholder="One highlight per line. Leave empty if you have not written it down." onChange={(event) => updateExperience(index, { highlightsText: event.target.value })} className="min-h-20 text-base" />
              <Button type="button" variant="ghost" className="h-10 justify-start px-0" onClick={() => setDraft({ ...draft, experiences: draft.experiences.filter((_, itemIndex) => itemIndex !== index) })}>
                Remove
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" className="h-11" onClick={() => setDraft({ ...draft, experiences: [...draft.experiences, { company: "", title: "", start: "", end: "", highlightsText: "" }] })}>
            Add experience
          </Button>
        </fieldset>

        <fieldset className="grid gap-3">
          <legend className="font-medium">Skills</legend>
          {draft.skills.map((item, index) => (
            <div key={index} className="grid grid-cols-[1fr_7.5rem] gap-2">
              <Input value={item.name} aria-label="Skill" onChange={(event) => updateSkill(index, { name: event.target.value })} className="h-11 text-base" />
              <select
                aria-label="Skill level"
                value={item.level}
                onChange={(event) => updateSkill(index, { level: event.target.value as "proficient" | "basic" })}
                className="h-11 rounded-lg border border-input bg-transparent px-2 text-sm"
              >
                <option value="proficient">Proficient</option>
                <option value="basic">Basic</option>
              </select>
            </div>
          ))}
          <Button type="button" variant="outline" className="h-11" onClick={() => setDraft({ ...draft, skills: [...draft.skills, { name: "", level: "proficient", notes: "" }] })}>
            Add skill
          </Button>
        </fieldset>

        <fieldset className="grid gap-3">
          <legend className="font-medium">Languages</legend>
          {draft.languages.map((item, index) => (
            <div key={index} className="grid grid-cols-2 gap-2">
              <Input
                value={item.name}
                aria-label="Language"
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    languages: draft.languages.map((language, languageIndex) =>
                      languageIndex === index ? { ...language, name: event.target.value } : language,
                    ),
                  })
                }
                className="h-11 text-base"
              />
              <Input
                value={item.level}
                aria-label="Language level"
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    languages: draft.languages.map((language, languageIndex) =>
                      languageIndex === index ? { ...language, level: event.target.value } : language,
                    ),
                  })
                }
                className="h-11 text-base"
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => setDraft({ ...draft, languages: [...draft.languages, { name: "", level: "" }] })}
          >
            Add language
          </Button>
        </fieldset>

        <Button type="submit" className="h-12 text-base" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </form>

      <Button
        type="button"
        variant="ghost"
        className="h-11 justify-start px-0"
        onClick={() => {
          void fetch("/api/session", { method: "DELETE" }).then(() => {
            router.replace("/login");
            router.refresh();
          });
        }}
      >
        Sign out
      </Button>
    </div>
  );

  function updateEducation(index: number, patch: Partial<Draft["education"][number]>) {
    setDraft({
      ...draft,
      education: draft.education.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    });
  }

  function updateExperience(index: number, patch: Partial<ExperienceDraft>) {
    setDraft({
      ...draft,
      experiences: draft.experiences.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    });
  }

  function updateSkill(index: number, patch: Partial<Draft["skills"][number]>) {
    setDraft({
      ...draft,
      skills: draft.skills.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    });
  }
}
