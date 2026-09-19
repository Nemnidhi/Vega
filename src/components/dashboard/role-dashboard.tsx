import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { RoleDashboard } from "@/lib/dashboard/role-home";

const TONES = {
  blue: "border-[#2f6bff]/35 bg-[#12213c] text-[#6da2ff]",
  green: "border-[#22c55e]/30 bg-[#0f2418] text-[#5fd88c]",
  amber: "border-[#eab308]/30 bg-[#2a2210] text-[#e6bb3f]",
  violet: "border-[#8b5cf6]/30 bg-[#1c1733] text-[#a98bff]",
  red: "border-[#ef4444]/30 bg-[#2b1416] text-[#f47171]",
  cyan: "border-[#22d3ee]/30 bg-[#0d2328] text-[#67e8f9]",
} as const;

const ITEM_TONES = {
  default: "text-vega-text",
  danger: "text-[#f47171]",
  warning: "text-[#e6bb3f]",
} as const;

function greeting(now: Date) {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * The dashboard for everyone who is not running the business.
 *
 * Deliberately not the owner's overview with panels removed - a developer has no
 * use for pipeline-by-source however it is filtered. It shows the few figures
 * that role opens the app to check, then the things they are expected to act on.
 */
export function RoleDashboardView({
  data,
  firstName,
}: {
  data: RoleDashboard;
  firstName: string;
}) {
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-[26px] font-semibold leading-8 text-vega-text lg:text-[28px]">
          {greeting(new Date())}, {firstName} <span aria-hidden="true">👋</span>
        </h1>
        <p className="mt-1 text-sm text-vega-text-muted">{data.headline}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {data.metrics.map((metric) => (
          <div
            key={metric.key}
            className="min-w-0 rounded-xl border border-vega-border bg-vega-surface-1 p-4"
          >
            <p className="truncate text-[13px] text-vega-text-muted">{metric.label}</p>
            <p className="mt-1.5 truncate text-[26px] font-semibold leading-8 text-vega-text">
              {metric.value}
            </p>
            <span
              className={cn(
                "mt-2 inline-block h-1 w-9 rounded-full border-0",
                TONES[metric.tone].split(" ")[1],
              )}
              aria-hidden="true"
            />
            {metric.hint ? (
              <p className="mt-1.5 truncate text-[11px] text-vega-text-dim">{metric.hint}</p>
            ) : null}
          </div>
        ))}
      </div>

      {data.progress.length > 0 ? (
        <div className="rounded-xl border border-vega-border bg-vega-surface-1 p-4">
          <h2 className="text-[15px] font-semibold text-vega-text">Progress</h2>
          <div className="mt-3 space-y-3.5">
            {data.progress.map((row) => {
              const percent =
                row.target > 0 ? Math.min(100, Math.round((row.achieved / row.target) * 100)) : 0;
              return (
                <div key={row.label}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-[13px] capitalize text-vega-text-secondary">
                      {row.label}
                    </span>
                    <span className="shrink-0 text-[12px] font-medium text-vega-text">{percent}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-vega-surface-2">
                    <div
                      className="h-full rounded-full bg-vega-accent"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-vega-text-dim">{row.display}</p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {data.lists.map((list) => (
          <div
            key={list.title}
            className="flex min-w-0 flex-col rounded-xl border border-vega-border bg-vega-surface-1 p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="truncate text-[15px] font-semibold text-vega-text">{list.title}</h2>
              <Link
                href={list.href}
                className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-vega-accent hover:text-vega-accent-hover"
              >
                View all
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              </Link>
            </div>

            {list.items.length === 0 ? (
              <p className="py-6 text-center text-xs text-vega-text-muted">{list.emptyText}</p>
            ) : (
              <ul className="space-y-2.5">
                {list.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="flex items-start gap-3 rounded-lg px-1 py-1.5 transition-colors hover:bg-vega-surface-hover"
                    >
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block truncate text-[13px] font-medium",
                            ITEM_TONES[item.tone ?? "default"],
                          )}
                        >
                          {item.title}
                        </span>
                        {item.detail ? (
                          <span className="block truncate text-[11px] text-vega-text-muted">
                            {item.detail}
                          </span>
                        ) : null}
                      </span>
                      {item.meta ? (
                        <span className="shrink-0 text-[11px] text-vega-text-dim">{item.meta}</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
