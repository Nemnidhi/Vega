import type { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-8">
      <div className="w-full max-w-[1040px] rounded-lg border border-border bg-vega-surface-1 p-3 shadow-sm md:p-4">
        <div className="grid items-stretch gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-lg bg-sidebar p-6 text-white md:p-8">
            <p className="text-[11px] font-semibold uppercase text-sidebar-muted">Vega HRMS</p>
            <h1 className="mt-3 max-w-md text-3xl font-semibold leading-tight md:text-4xl">
              Command Center
            </h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-sidebar-muted">
              Manage leads, clients, and team tasks with a clean interface built for clarity,
              speed, and everyday execution.
            </p>
            <div className="mt-8 grid gap-2 text-sm text-white">
              {["Role-based secure access", "Structured task tracking", "Live team and delivery visibility"].map((item, index) => (
                <div key={item} className="flex items-center gap-3 rounded-lg border border-sidebar-border bg-white/[0.04] p-3">
                  <span className="font-mono text-xs text-sidebar-muted">{String(index + 1).padStart(2, "0")}</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>
          <div>{children}</div>
        </div>
      </div>
    </main>
  );
}
