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
    <header className="mb-4 border-b border-vega-border-soft pb-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-vega-text-muted">Operations</p>
          <h2 className="mt-1 text-[28px] font-semibold leading-[34px] tracking-normal text-vega-text">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 max-w-3xl text-sm leading-5 text-vega-text-muted">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge variant="accent">Command Active</Badge>
          {cta ? (
            <Link
              href={cta.href}
              className="inline-flex h-[34px] items-center justify-center rounded-md border border-vega-border bg-vega-surface-1 px-3 text-xs font-medium text-vega-text-secondary transition-colors duration-150 hover:border-vega-purple-border hover:bg-vega-purple-soft hover:text-vega-text"
            >
              {cta.label}
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
