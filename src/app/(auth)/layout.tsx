import type { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-8">
      <div className="w-full max-w-[980px] rounded-2xl border border-white/75 bg-white/92 p-4 shadow-sm md:p-6">
        <div className="grid items-center gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-xl border border-accent/16 bg-surface-soft p-6 md:p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Vega</p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight text-foreground md:text-4xl">
              Command Your Workflow
            </h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground">
              Manage leads, projects, and team tasks with a clean interface built for clarity,
              speed, and everyday execution.
            </p>
            <div className="mt-7 grid gap-2 text-sm text-muted-foreground">
              <p>01 Role-based secure access</p>
              <p>02 Structured project and task tracking</p>
              <p>03 Live team and delivery visibility</p>
            </div>
          </section>
          <div>{children}</div>
        </div>
      </div>
    </main>
  );
}
