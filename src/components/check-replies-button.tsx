"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function CheckRepliesButton({ id, block = false }: { id: string; block?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function check() {
    setPending(true);
    setError("");
    const response = await fetch(`/api/applications/${id}/replies`, { method: "POST" });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    setPending(false);
    if (!response.ok) {
      setError(payload?.error ?? "Replies could not be checked.");
      return;
    }
    router.refresh();
  }

  return (
    <div className={block ? "grid gap-2" : "grid content-center gap-1"}>
      <Button type="button" variant="outline" className="h-11 px-3" disabled={pending} onClick={() => void check()}>
        {pending ? "…" : "Check replies"}
      </Button>
      {error ? (
        <p className={block ? "text-sm text-destructive" : "max-w-28 text-xs text-destructive"}>{error}</p>
      ) : null}
    </div>
  );
}
