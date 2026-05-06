import type { ReactNode } from "react";

interface ClientAuthLayoutProps {
  children: ReactNode;
}

export default function ClientAuthLayout({ children }: ClientAuthLayoutProps) {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <div className="w-full max-w-[980px] rounded-xl border border-border bg-white p-4 shadow-sm md:p-6">
        <div className="grid items-center gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-lg border border-border bg-surface-soft p-6 md:p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Client Portal
            </p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight text-foreground md:text-4xl">
              Project Query Desk
            </h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground">
              Raise project-related questions, track progress, and get responses from the delivery
              team in one place.
            </p>
            <div className="mt-7 grid gap-2 text-sm text-muted-foreground">
              <p>01 Create your client account</p>
              <p>02 Login to query portal</p>
              <p>03 Raise and track project queries</p>
            </div>
          </section>
          <div>{children}</div>
        </div>
      </div>
    </main>
  );
}
