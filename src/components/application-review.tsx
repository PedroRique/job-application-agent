"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ApplicationRecord } from "@/lib/applications/repository";
import { formatDateTime } from "@/lib/format";
import { CheckRepliesButton } from "@/components/check-replies-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  application: ApplicationRecord;
  resumeFileName: string | null;
  outlookConnected: boolean;
  outlookEmail: string | null;
  microsoftConfigured: boolean;
};

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function ApplicationReview({
  application,
  resumeFileName,
  outlookConnected,
  outlookEmail,
  microsoftConfigured,
}: Props) {
  const router = useRouter();
  const sent = application.status === "sent";
  const [company, setCompany] = useState(application.company);
  const [position, setPosition] = useState(application.position);
  const [recruiterEmail, setRecruiterEmail] = useState(application.recruiterEmail ?? "");
  const [subject, setSubject] = useState(application.emailSubject);
  const [body, setBody] = useState(application.emailBody);
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(application.status === "failed" ? application.errorMessage ?? "" : "");
  const [warning, setWarning] = useState("");
  const [translating, setTranslating] = useState("");

  const analysis = application.jobAnalysis;
  const emailReady = validEmail(recruiterEmail);
  const fieldsReady = company.trim() && position.trim() && subject.trim() && body.trim();
  let blocker = "";
  if (!microsoftConfigured) blocker = "Microsoft sign-in is not configured.";
  else if (!outlookConnected) blocker = "Outlook not connected";
  else if (!resumeFileName) blocker = "Resume is not configured.";
  else if (!emailReady) blocker = "Enter a valid recipient email.";
  else if (!fieldsReady) blocker = "Company, position, subject, and email are required.";

  useEffect(() => {
    if (!dirty || sent) return;
    if (!company.trim() || !position.trim() || !subject.trim() || !body.trim()) return;
    if (recruiterEmail && !validEmail(recruiterEmail)) return;
    const timer = setTimeout(() => {
      void fetch(`/api/applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company,
          position,
          recruiterName: application.recruiterName,
          recruiterEmail: recruiterEmail || null,
          emailSubject: subject,
          emailBody: body,
        }),
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [application.id, application.recruiterName, body, company, dirty, position, recruiterEmail, sent, subject]);

  function edit<T>(setter: (value: T) => void, value: T) {
    setter(value);
    setDirty(true);
    setConfirming(false);
  }

  async function translate(language: "pt" | "en") {
    setTranslating(language);
    setError("");
    const response = await fetch(`/api/applications/${application.id}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language }),
    });
    const payload = (await response.json().catch(() => null)) as { body?: string; error?: string } | null;
    setTranslating("");
    if (!response.ok || !payload?.body) {
      setError(payload?.error ?? "The email could not be translated.");
      return;
    }
    setBody(payload.body);
    setDirty(false);
  }

  async function send() {
    setPending(true);
    setError("");
    setWarning("");
    const response = await fetch(`/api/applications/${application.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company,
        position,
        recruiterName: application.recruiterName,
        recruiterEmail,
        emailSubject: subject,
        emailBody: body,
      }),
    });
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      warning?: string;
      status?: string;
    } | null;
    setPending(false);
    setConfirming(false);
    if (!response.ok) {
      setError(payload?.error ?? "The email could not be sent. It was not marked as sent.");
      return;
    }
    if (payload?.warning) setWarning(payload.warning);
    router.refresh();
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-heading text-2xl leading-tight">{position}</p>
          <p className="text-muted-foreground">{company}</p>
        </div>
        <Badge variant={sent ? "default" : application.status === "failed" ? "destructive" : "secondary"}>
          {application.status}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        {[analysis.location, analysis.workMode === "unknown" ? null : analysis.workMode, analysis.seniority]
          .filter(Boolean)
          .join(" · ")}
      </p>

      <section className="grid gap-2">
        <h2 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground">MATCH</h2>
        {analysis.match.strengths.length === 0 ? (
          <p className="text-sm">No direct skill overlap found.</p>
        ) : (
          <ul className="grid gap-1 text-sm">
            {analysis.match.strengths.map((item) => (
              <li key={item.skillName}>✓ {item.skillName}</li>
            ))}
          </ul>
        )}
      </section>

      {analysis.match.relevantExperience.length > 0 ? (
        <section className="grid gap-2">
          <h2 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground">EXPERIENCE ON FILE</h2>
          <ul className="grid gap-1 text-sm">
            {analysis.match.relevantExperience.map((item) => (
              <li key={item.company}>{item.company}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-2">
        <h2 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground">GAPS</h2>
        {analysis.match.gaps.length === 0 ? (
          <p className="text-sm">No gaps spotted from your profile.</p>
        ) : (
          <ul className="grid gap-1 text-sm">
            {analysis.match.gaps.map((item) => (
              <li key={item.label}>△ {item.label}</li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="company">Company</Label>
          <Input id="company" value={company} readOnly={sent} onChange={(event) => edit(setCompany, event.target.value)} className="h-11 text-base" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="position">Position</Label>
          <Input id="position" value={position} readOnly={sent} onChange={(event) => edit(setPosition, event.target.value)} className="h-11 text-base" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="to">To</Label>
          <Input
            id="to"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={recruiterEmail}
            readOnly={sent}
            placeholder="recruiter@company.com"
            onChange={(event) => edit(setRecruiterEmail, event.target.value)}
            className="h-11 text-base"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="subject">Subject</Label>
          <Input id="subject" value={subject} readOnly={sent} onChange={(event) => edit(setSubject, event.target.value)} className="h-11 text-base" />
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="email">Email</Label>
            {sent ? null : (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 px-3"
                  disabled={Boolean(translating)}
                  onClick={() => void translate("pt")}
                >
                  {translating === "pt" ? "…" : "PT"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 px-3"
                  disabled={Boolean(translating)}
                  onClick={() => void translate("en")}
                >
                  {translating === "en" ? "…" : "EN"}
                </Button>
              </div>
            )}
          </div>
          <Textarea
            id="email"
            value={body}
            readOnly={sent}
            onChange={(event) => edit(setBody, event.target.value)}
            className="min-h-72 text-base leading-6"
          />
        </div>
      </div>

      <div className="rounded-xl bg-card px-3 py-3 text-sm ring-1 ring-foreground/10">
        <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground">ATTACHMENT</p>
        {resumeFileName ? <p className="mt-1">✓ {resumeFileName}</p> : <p className="mt-1">Resume is not configured.</p>}
      </div>

      {sent ? (
        <div className="grid gap-3">
          <p className="text-sm">
            <span className="mr-2 inline-flex rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
              Sent
            </span>
            {application.sentAt ? formatDateTime(application.sentAt) : ""}
            {outlookEmail ? ` from ${outlookEmail}` : ""}.
          </p>
          {application.replyFrom ? (
            <div className="rounded-xl bg-card px-3 py-3 text-sm ring-1 ring-foreground/10">
              <p className="font-medium">Replied · {application.replyFrom}</p>
              {application.replyReceivedAt ? (
                <p className="text-muted-foreground">{formatDateTime(application.replyReceivedAt)}</p>
              ) : null}
              {application.replyPreview ? <p className="mt-2 leading-6">{application.replyPreview}</p> : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No reply stored yet.</p>
          )}
          <CheckRepliesButton id={application.id} block />
        </div>
      ) : (
        <div className="grid gap-3">
          {blocker ? (
            <p className="text-sm">
              {blocker}{" "}
              {blocker === "Outlook not connected" || blocker === "Resume is not configured." ? (
                <Link href="/profile" className="underline">
                  Open profile
                </Link>
              ) : null}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              This sends from {outlookEmail ?? "your Hotmail account"} after you confirm.
            </p>
          )}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {warning ? <p className="text-sm">{warning}</p> : null}
          <Button
            type="button"
            className="h-12 text-base"
            disabled={Boolean(blocker) || pending}
            onClick={() => {
              if (!confirming) {
                setConfirming(true);
                return;
              }
              void send();
            }}
          >
            {pending ? "Sending…" : confirming ? "Confirm send from Hotmail" : "Send application"}
          </Button>
        </div>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer font-medium">Job details</summary>
        <p className="mt-3 leading-6">{analysis.summary}</p>
        {analysis.requirements.length > 0 ? (
          <ul className="mt-3 grid list-disc gap-1 pl-4">
            {analysis.requirements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
      </details>
    </div>
  );
}
