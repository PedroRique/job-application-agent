import { JobIntake } from "@/components/job-intake";
import { integrationFlags } from "@/lib/env";

export default function HomePage() {
  const flags = integrationFlags();
  return <JobIntake flags={{ database: flags.database, openai: flags.openai }} />;
}
