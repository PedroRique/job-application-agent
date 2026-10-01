"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function DeleteApplicationButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function remove() {
    if (!window.confirm("Remove this application from history? A sent email stays in Hotmail.")) return;
    setPending(true);
    const response = await fetch(`/api/applications/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setPending(false);
      window.alert("The application could not be deleted.");
      return;
    }
    router.refresh();
  }

  return (
    <Button type="button" variant="destructive" className="h-11 self-center px-3" disabled={pending} onClick={() => void remove()}>
      {pending ? "…" : "Delete"}
    </Button>
  );
}
