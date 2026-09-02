import type { ReactNode } from "react";

interface ClientAuthLayoutProps {
  children: ReactNode;
}

export default function ClientAuthLayout({ children }: ClientAuthLayoutProps) {
  return (
    <main className="grid min-h-screen place-items-start bg-background px-3 py-4 sm:px-4 sm:py-8 lg:place-items-center">
      <div className="w-full max-w-[1040px] rounded-lg border border-border bg-vega-surface-1 p-3 shadow-sm md:p-4">
        <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
          <section className="order-2 rounded-lg bg-sidebar p-5 text-white sm:p-6 md:p-8 lg:order-1">
            <p className="text-[11px] font-semibold uppercase text-sidebar-muted">
              Client Portal
            </p>
            <h1 className="mt-3 text-2xl font-semibold leading-tight sm:text-3xl md:text-4xl">
              Client Query Desk
            </h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-sidebar-muted sm:mt-4 sm:leading-7">
              Raise service-related questions, track delivery progress, and get quick responses
              from the team in one refined workspace.
            </p>
            <div className="mt-5 grid gap-2 text-xs text-white sm:mt-7 sm:text-sm">
              {["Create your client account", "Login to query portal", "Raise and track service queries"].map((item, index) => (
                <div key={item} className="flex items-center gap-3 rounded-lg border border-sidebar-border bg-white/[0.04] p-3">
                  <span className="font-mono text-xs text-sidebar-muted">{String(index + 1).padStart(2, "0")}</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>
          <div className="order-1 lg:order-2">{children}</div>
        </div>
      </div>
    </main>
  );
}
