import { notFound, unstable_rethrow } from "next/navigation";
import { ApplicationReview } from "@/components/application-review";
import { getApplication, type ApplicationRecord } from "@/lib/applications/repository";
import { integrationFlags } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { outlookStatus } from "@/lib/microsoft/msal";
import { getLatestResume } from "@/lib/resume";

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const flags = integrationFlags();
  let application: ApplicationRecord | null = null;
  let errorMessage = "";
  let resumeFileName: string | null = null;
  let outlookConnected = false;
  let outlookEmail: string | null = null;

  try {
    application = await getApplication(id);
    if (!application) notFound();
    const resume = await getLatestResume();
    const outlook = flags.microsoftApp
      ? await outlookStatus()
      : { connected: false, accountEmail: null };
    resumeFileName = resume?.fileName ?? null;
    outlookConnected = outlook.connected;
    outlookEmail = outlook.accountEmail;
  } catch (error) {
    unstable_rethrow(error);
    errorMessage = error instanceof AppError ? error.message : "The application could not be loaded.";
  }

  if (errorMessage || !application) return <p className="text-sm">{errorMessage}</p>;

  return (
    <ApplicationReview
      application={application}
      resumeFileName={resumeFileName}
      outlookConnected={outlookConnected}
      outlookEmail={outlookEmail}
      microsoftConfigured={flags.microsoftApp}
    />
  );
}
