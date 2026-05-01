import type { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-[980px] rounded-[2rem] border border-border/70 bg-surface/85 p-4 shadow-[0_18px_45px_rgba(6,24,46,0.12)] backdrop-blur md:p-8">
        <div className="grid items-center gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-white/20 bg-[linear-gradient(145deg,#08182e_0%,#0f3251_55%,#0b6b6a_100%)] p-6 text-white md:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">
              HRMS
            </p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight md:text-4xl">
              Strategic Revenue Command
            </h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-white/85">
              Capture intent, qualify demand, lock scope, and protect delivery margins from one
              premium control surface.
            </p>
            <div className="mt-7 grid gap-2 text-sm text-white/80">
              <p>01 Lead Intelligence and Filtration</p>
              <p>02 Scope Lock and Proposal Governance</p>
              <p>03 Margin Protection and Audit Trail</p>
            </div>
          </section>
          <div>{children}</div>
        </div>
      </div>
    </main>
  );
}
