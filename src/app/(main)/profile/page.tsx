import { ProfileEditor } from "@/components/profile-editor";
import { integrationFlags } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { outlookStatus } from "@/lib/microsoft/msal";
import { getProfile } from "@/lib/profile/repository";
import { getLatestResume } from "@/lib/resume";

const notices: Record<string, string> = {
  connected: "Outlook connected.",
  cancelled: "Microsoft sign-in was cancelled.",
  failed: "Microsoft sign-in failed.",
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ outlook?: string | string[] }>;
}) {
  const query = await searchParams;
  const outlookCode = typeof query.outlook === "string" ? query.outlook : "";
  const notice = notices[outlookCode] ?? null;
  const flags = integrationFlags();

  if (!flags.database) {
    return <p className="text-sm">Database is not configured.</p>;
  }

  let profile = null as Awaited<ReturnType<typeof getProfile>>["profile"] | null;
  let resumeFileName: string | null = null;
  let outlookConnected = false;
  let outlookEmail: string | null = null;
  let errorMessage = "";

  try {
    const [loaded, resume, outlook] = await Promise.all([
      getProfile(),
      getLatestResume(),
      flags.microsoftApp ? outlookStatus() : Promise.resolve({ connected: false, accountEmail: null }),
    ]);
    profile = loaded.profile;
    resumeFileName = resume?.fileName ?? null;
    outlookConnected = outlook.connected;
    outlookEmail = outlook.accountEmail;
  } catch (error) {
    errorMessage = error instanceof AppError ? error.message : "The profile could not be loaded.";
  }

  if (errorMessage || !profile) return <p className="text-sm">{errorMessage}</p>;

  return (
    <ProfileEditor
      profile={profile}
      resumeFileName={resumeFileName}
      outlookConnected={outlookConnected}
      outlookEmail={outlookEmail}
      microsoftConfigured={flags.microsoftApp}
      notice={notice}
    />
  );
}
