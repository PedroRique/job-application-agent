import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CheckRepliesButton } from "@/components/check-replies-button";
import { DeleteApplicationButton } from "@/components/delete-application-button";
import { AppError } from "@/lib/errors";
import { formatShortDate } from "@/lib/format";
import { listApplications } from "@/lib/applications/repository";

export default async function ApplicationsPage() {
  let applications: Awaited<ReturnType<typeof listApplications>> = [];
  let errorMessage = "";
  try {
    applications = await listApplications();
  } catch (error) {
    errorMessage = error instanceof AppError ? error.message : "Applications could not be loaded.";
  }

  if (errorMessage) return <p className="text-sm">{errorMessage}</p>;
  if (applications.length === 0) {
    return (
      <div className="grid gap-2">
        <h1 className="font-heading text-2xl">History</h1>
        <p className="text-sm text-muted-foreground">No applications yet.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <h1 className="font-heading text-2xl">History</h1>
      <ul className="grid gap-2">
        {applications.map((application) => (
          <li key={application.id} className="flex items-stretch gap-2">
            <Link
              href={`/applications/${application.id}`}
              className="grid min-w-0 flex-1 gap-1 rounded-xl bg-card px-3 py-3 ring-1 ring-foreground/10"
            >
              <span className="flex items-start justify-between gap-2">
                <span className="font-medium">{application.company}</span>
                {application.reply_from ? <Badge>Replied</Badge> : null}
                {application.status === "sent" && !application.reply_from ? <Badge>Sent</Badge> : null}
                {application.status === "failed" ? <Badge variant="destructive">Failed</Badge> : null}
              </span>
              <span className="text-sm">{application.position}</span>
              <span className="text-sm text-muted-foreground">
                {formatShortDate(application.created_at)}
                {application.status === "draft" || application.status === "ready"
                  ? ` · ${application.status}`
                  : ""}
              </span>
            </Link>
            {application.status === "sent" ? <CheckRepliesButton id={application.id} /> : null}
            <DeleteApplicationButton id={application.id} />
          </li>
        ))}
      </ul>
    </div>
  );
}
