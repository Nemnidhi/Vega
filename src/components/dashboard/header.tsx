import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  showLeadCta?: boolean;
  action?: {
    label: string;
    href: string;
  };
}

export function DashboardHeader({
  title,
  subtitle,
  showLeadCta = true,
  action,
}: DashboardHeaderProps) {
  const cta = action
    ? action
    : showLeadCta
      ? {
          label: "New Lead",
          href: "/leads",
        }
      : null;

  return (
    <header className="mb-6 rounded-xl border border-border bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Operations
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
          {cta ? (
            <Link
              href={cta.href}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-white px-4 text-sm font-semibold tracking-wide text-foreground transition-colors hover:bg-surface-soft"
            >
              {cta.label}
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
