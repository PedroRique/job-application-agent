"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Flags = { database: boolean; openai: boolean };

type QueueStatus = "queued" | "analyzing" | "done" | "error";

type QueueItem = {
  key: string;
  label: string;
  status: QueueStatus;
  applicationId?: string;
  error?: string;
  body: FormData;
};

async function prepareScreenshot(file: File) {
  if (file.type === "image/png" && file.size < 1_200_000) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) return file;
  return new File([blob], "job.jpg", { type: "image/jpeg" });
}

function labelFor(mode: "screenshot" | "text", file: File | null, text: string) {
  if (mode === "text") {
    const snippet = text.trim().replace(/\s+/g, " ").slice(0, 72);
    return snippet || "Pasted job";
  }
  return file?.name || "Screenshot";
}

export function JobIntake({ flags }: { flags: Flags }) {
  const [mode, setMode] = useState<"screenshot" | "text">("screenshot");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const items = useRef<QueueItem[]>([]);
  const pumping = useRef(false);
  const blocked = !flags.database || !flags.openai;
  const active = queue.find((item) => item.status === "analyzing");

  function publish(next: QueueItem[]) {
    items.current = next;
    setQueue(next);
  }

  function patch(key: string, update: Partial<QueueItem>) {
    publish(items.current.map((item) => (item.key === key ? { ...item, ...update } : item)));
  }

  async function pump() {
    if (pumping.current) return;
    pumping.current = true;
    try {
      while (true) {
        const next = items.current.find((item) => item.status === "queued");
        if (!next) return;
        patch(next.key, { status: "analyzing" });
        const response = await fetch("/api/analyze", { method: "POST", body: next.body });
        const payload = (await response.json().catch(() => null)) as { id?: string; error?: string } | null;
        if (!response.ok || !payload?.id) {
          patch(next.key, { status: "error", error: payload?.error ?? "The job could not be analyzed." });
          continue;
        }
        patch(next.key, { status: "done", applicationId: payload.id });
      }
    } finally {
      pumping.current = false;
      if (items.current.some((item) => item.status === "queued")) void pump();
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (blocked) return;
    setError("");
    if (mode === "text" && text.trim().length < 40) {
      setError("Paste the job description, or upload a screenshot.");
      return;
    }
    if (mode === "screenshot" && !file) {
      setError("Choose a screenshot first.");
      return;
    }
    const body = new FormData();
    const label = labelFor(mode, file, text);
    if (mode === "text") body.set("description", text.trim());
    else if (file) body.set("screenshot", await prepareScreenshot(file));
    const item: QueueItem = { key: crypto.randomUUID(), label, status: "queued", body };
    publish([...items.current, item]);
    setFile(null);
    setText("");
    void pump();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {active ? (
        <p className="rounded-xl bg-card px-4 py-4 font-heading text-2xl tracking-tight ring-1 ring-foreground/10">
          Analyzing…
          <span className="mt-1 block text-sm font-sans font-normal text-muted-foreground">{active.label}</span>
        </p>
      ) : (
        <p className="text-sm leading-6 text-muted-foreground">
          Upload a screenshot or paste the posting. You review the email before anything is sent.
        </p>
      )}
      {!flags.database ? (
        <p className="rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-foreground/10">
          Supabase is not configured, so applications cannot be saved.
        </p>
      ) : null}
      {!flags.openai ? (
        <p className="rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-foreground/10">
          OpenAI is not configured, so jobs cannot be analyzed.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={mode === "screenshot" ? "default" : "outline"}
          className="h-11"
          onClick={() => setMode("screenshot")}
        >
          Screenshot
        </Button>
        <Button
          type="button"
          variant={mode === "text" ? "default" : "outline"}
          className="h-11"
          onClick={() => setMode("text")}
        >
          Paste text
        </Button>
      </div>
      {mode === "screenshot" ? (
        <label className="grid gap-2 rounded-xl bg-card px-4 py-5 text-sm ring-1 ring-foreground/10">
          <span className="font-medium">Upload screenshot</span>
          <input
            key={queue.length}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <span className="text-muted-foreground">{file ? file.name : "PNG, JPEG, or WebP"}</span>
        </label>
      ) : (
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Paste the job description"
          className="min-h-56 text-base"
        />
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="h-12 text-base" disabled={blocked}>
        Analyze job
      </Button>
      {queue.length > 0 ? (
        <ul className="grid gap-2">
          {queue.map((item) => (
            <li key={item.key} className="rounded-xl bg-card px-3 py-3 text-sm ring-1 ring-foreground/10">
              <p className="font-medium">{item.label}</p>
              {item.status === "queued" ? <p className="text-muted-foreground">Queued</p> : null}
              {item.status === "analyzing" ? <p>Analyzing…</p> : null}
              {item.status === "error" ? <p className="text-destructive">{item.error}</p> : null}
              {item.status === "done" && item.applicationId ? (
                <Link href={`/applications/${item.applicationId}`} className="underline">
                  Open application
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
