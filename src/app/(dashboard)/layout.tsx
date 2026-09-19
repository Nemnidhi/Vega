import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { getCurrentSession } from "@/lib/auth/session";
import { LOGIN_PATH, LOGIN_ROLES } from "@/lib/auth/constants";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const session = await getCurrentSession();
  if (!session) {
    redirect(LOGIN_PATH);
  }
  if (session.role === "client") {
    redirect("/client/queries");
  }
  if (!LOGIN_ROLES.includes(session.role as (typeof LOGIN_ROLES)[number])) {
    redirect(LOGIN_PATH);
  }

  return <AppShell session={session}>{children}</AppShell>;
}
