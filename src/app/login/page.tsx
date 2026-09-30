import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { appLockConfigured, getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (appLockConfigured() && (await getSession())) redirect("/");

  return (
    <main className="mx-auto flex min-h-full w-full max-w-xl flex-col justify-center px-4 py-10">
      <p className="font-heading text-3xl tracking-tight">Job Application Agent</p>
      <p className="mt-2 mb-8 text-sm text-muted-foreground">
        A private desk for reading a job, checking it against your profile, and sending the email yourself.
      </p>
      {appLockConfigured() ? (
        <LoginForm />
      ) : (
        <p className="rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10">
          Set APP_PASSWORD and SESSION_SECRET on the server before signing in.
        </p>
      )}
    </main>
  );
}
