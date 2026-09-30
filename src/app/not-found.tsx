import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-full max-w-xl content-center gap-3 px-4">
      <p className="font-heading text-2xl">That page does not exist.</p>
      <Link href="/" className="text-sm underline">
        Back to a new application
      </Link>
    </main>
  );
}
