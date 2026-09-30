"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid gap-3">
      <p>Something went wrong.</p>
      <button type="button" onClick={reset} className="h-11 text-left text-sm underline">
        Try again
      </button>
    </div>
  );
}
