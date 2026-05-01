import type { ReactNode } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { MobileDashboardNav } from "@/components/dashboard/mobile-nav";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import type { AuthSession } from "@/lib/auth/session";

interface AppShellProps {
  children: ReactNode;
  session: AuthSession;
}

export function AppShell({ children, session }: AppShellProps) {
  return (
    <div className="min-h-screen lg:flex">
      <DashboardSidebar role={session.role} />
      <main className="mx-auto w-full max-w-[1300px] p-4 md:p-7 lg:p-8">
        <MobileDashboardNav />
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border/70 bg-surface/85 p-4 shadow-[0_14px_35px_rgba(7,24,44,0.08)] backdrop-blur">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Signed in as
            </p>
            <p className="truncate text-sm font-semibold text-foreground sm:text-base">
              {session.fullName ?? session.email} | {session.role.replaceAll("_", " ")}
            </p>
          </div>
          <LogoutButton />
        </div>
        {children}
      </main>
    </div>
  );
}
