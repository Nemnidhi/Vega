import type { ReactNode } from "react";
import { DashboardTopNav } from "@/components/dashboard/top-nav";
import type { AuthSession } from "@/lib/auth/session";

interface AppShellProps {
  children: ReactNode;
  session: AuthSession;
}

export function AppShell({ children, session }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_-10%,rgba(18,109,166,0.1),transparent_34%),radial-gradient(circle_at_92%_0%,rgba(31,138,84,0.08),transparent_30%)]">
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
