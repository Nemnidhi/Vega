import type { ReactNode } from "react";

interface ClientAuthLayoutProps {
  children: ReactNode;
}

export default function ClientAuthLayout({ children }: ClientAuthLayoutProps) {
  return (
    <main className="grid min-h-screen place-items-start px-3 py-4 sm:px-4 sm:py-8 lg:place-items-center">
      <div className="w-full max-w-[980px] rounded-lg border border-border bg-white p-3 shadow-sm sm:rounded-xl sm:p-4 md:p-6">
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <section className="order-2 rounded-lg border border-border bg-surface-soft p-4 sm:p-6 md:p-7 lg:order-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Client Portal
            </p>
            <h1 className="mt-3 text-2xl font-semibold leading-tight text-foreground sm:text-3xl md:text-4xl">
              Project Query Desk
            </h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground sm:mt-4 sm:leading-7">
              Raise project-related questions, track progress, and get responses from the delivery
              team in one place.
            </p>
            <div className="mt-5 grid gap-2 text-xs text-muted-foreground sm:mt-7 sm:text-sm">
              <p>01 Create your client account</p>
              <p>02 Login to query portal</p>
              <p>03 Raise and track project queries</p>
            </div>
          </section>
          <div className="order-1 lg:order-2">{children}</div>
        </div>
      </div>
    </main>
  );
}
