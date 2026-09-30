"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Flags = { database: boolean; openai: boolean };

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

export function JobIntake({ flags }: { flags: Flags }) {
  const router = useRouter();
  const [mode, setMode] = useState<"screenshot" | "text">("screenshot");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const blocked = !flags.database || !flags.openai;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (blocked) return;
    setPending(true);
    setError("");
    const form = new FormData();
    if (mode === "text") form.set("description", text);
    else if (file) form.set("screenshot", await prepareScreenshot(file));
    const response = await fetch("/api/analyze", { method: "POST", body: form });
    const body = (await response.json().catch(() => null)) as { id?: string; error?: string } | null;
    setPending(false);
    if (!response.ok || !body?.id) {
      setError(body?.error ?? "The job could not be analyzed.");
      return;
    }
    router.push(`/applications/${body.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <p className="text-sm leading-6 text-muted-foreground">
        Upload a screenshot or paste the posting. You review the email before anything is sent.
      </p>
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
      <Button type="submit" className="h-12 text-base" disabled={pending || blocked}>
        {pending ? "Analyzing…" : "Analyze job"}
      </Button>
    </form>
  );
}
