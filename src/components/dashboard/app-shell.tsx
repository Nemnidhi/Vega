import type { ReactNode } from "react";
import { DashboardTopNav } from "@/components/dashboard/top-nav";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import type { AuthSession } from "@/lib/auth/session";

interface AppShellProps {
  children: ReactNode;
  session: AuthSession;
}

export function AppShell({ children, session }: AppShellProps) {
  return (
    <div className="min-h-screen bg-vega-bg text-vega-text">
      <div className="flex min-h-screen">
        <DashboardSidebar role={session.role} userLabel={session.fullName ?? session.email} />
        <div className="min-w-0 flex-1">
          <DashboardTopNav
            role={session.role}
            userLabel={session.fullName ?? session.email}
          />
          <main className="w-full px-3 pb-7 pt-4 sm:px-5 lg:px-[22px] lg:pt-[18px]">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
