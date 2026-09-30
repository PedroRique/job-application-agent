import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { appLockConfigured, getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  if (!appLockConfigured() || !(await getSession())) redirect("/login");
  return <AppShell>{children}</AppShell>;
}
