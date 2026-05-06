import type { ReactNode } from "react";
import { DashboardTopNav } from "@/components/dashboard/top-nav";
import type { AuthSession } from "@/lib/auth/session";

interface AppShellProps {
  children: ReactNode;
  session: AuthSession;
}

export function AppShell({ children, session }: AppShellProps) {
  return (
    <div className="min-h-screen">
      <main className="mx-auto w-full max-w-[1300px] p-4 md:p-6 lg:p-7">
        <DashboardTopNav
          role={session.role}
          userLabel={session.fullName ?? session.email}
        />
        {children}
      </main>
    </div>
  );
}
