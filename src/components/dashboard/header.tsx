import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
}

export function DashboardHeader({ title, subtitle }: DashboardHeaderProps) {
  return (
    <header className="relative mb-6 overflow-hidden rounded-3xl border border-border/70 bg-surface/88 p-5 shadow-[0_16px_42px_rgba(8,26,48,0.1)] backdrop-blur md:p-6">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(16,170,154,0.18)_0%,rgba(16,170,154,0)_70%)]" />
      <div className="pointer-events-none absolute -bottom-20 left-1/3 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(29,78,216,0.14)_0%,rgba(29,78,216,0)_70%)]" />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Strategic Operations
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          {title}
          </h2>
          {subtitle ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="accent">Command Active</Badge>
          <Button variant="secondary">New Lead</Button>
        </div>
      </div>
    </header>
  );
}
