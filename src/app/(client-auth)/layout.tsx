import type { ReactNode } from "react";

interface ClientAuthLayoutProps {
  children: ReactNode;
}

export default function ClientAuthLayout({ children }: ClientAuthLayoutProps) {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-[980px] rounded-[2rem] border border-border/70 bg-surface/85 p-4 shadow-[0_18px_45px_rgba(6,24,46,0.12)] backdrop-blur md:p-8">
        <div className="grid items-center gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-white/20 bg-[linear-gradient(145deg,#08182e_0%,#0f3251_55%,#0b6b6a_100%)] p-6 text-white md:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">
              Client Portal
            </p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight md:text-4xl">
              Project Query Desk
            </h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-white/85">
              Raise project-related questions, track progress, and get responses from the delivery
              team in one place.
            </p>
            <div className="mt-7 grid gap-2 text-sm text-white/80">
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
