import Link from "next/link";
import {
  CalendarDays,
  ChartNoAxesColumn,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock,
  ListTodo,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { DeveloperDashboard } from "@/lib/dashboard/role-home";

const TONES = {
  blue: { tile: "bg-[#12213c] text-[#6da2ff]", stroke: "#4d8dff" },
  green: { tile: "bg-[#0f2418] text-[#5fd88c]", stroke: "#5fd88c" },
  red: { tile: "bg-[#2b1416] text-[#f47171]", stroke: "#f47171" },
  violet: { tile: "bg-[#1c1733] text-[#a98bff]", stroke: "#a98bff" },
  amber: { tile: "bg-[#2a2210] text-[#e6bb3f]", stroke: "#e6bb3f" },
  cyan: { tile: "bg-[#0d2328] text-[#67e8f9]", stroke: "#67e8f9" },
} as const;

const METRIC_ICONS = {
  open: ListTodo,
  today: CalendarDays,
  overdue: CircleAlert,
  worked: Clock,
} as const;

const LIST_ICONS = {
  overdue: { icon: CircleAlert, tone: "text-[#f47171]" },
  today: { icon: CalendarDays, tone: "text-[#5fd88c]" },
  all: { icon: UserRound, tone: "text-[#6da2ff]" },
} as const;

const panel = "rounded-xl border border-vega-border bg-vega-surface-1";

function greeting(now: Date) {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Whole-number gridline labels, never repeating on a small maximum. */
function axisTicks(max: number) {
  const ticks = new Set<number>([max, 0]);
  const steps = Math.min(4, Math.max(1, max));
  for (let index = 1; index < steps; index += 1) {
    ticks.add(Math.round((max / steps) * (steps - index)));
  }
  return [...ticks].sort((a, b) => b - a);
}

function hoursAndMinutes(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  return `${Math.floor(safe / 60)}h ${String(safe % 60).padStart(2, "0")}m`;
}

/** Seven days of a metric, drawn as a path. Flat data still draws a flat line. */
function Sparkline({ series, stroke }: { series: number[]; stroke: string }) {
  const width = 72;
  const height = 32;
  const max = Math.max(...series, 1);
  const step = series.length > 1 ? width / (series.length - 1) : width;
  const points = series.map((value, index) => ({
    x: index * step,
    y: height - (value / max) * (height - 4) - 2,
  }));

  const path = points
    .map((point, index, all) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      const previous = all[index - 1];
      const midX = (previous.x + point.x) / 2;
      return `C ${midX} ${previous.y} ${midX} ${point.y} ${point.x} ${point.y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-8 w-[72px] shrink-0" aria-hidden="true">
      <path d={path} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SparkBars({ series, stroke }: { series: number[]; stroke: string }) {
  const max = Math.max(...series, 1);
  return (
    <span className="flex h-8 w-[72px] shrink-0 items-end gap-[3px]" aria-hidden="true">
      {series.map((value, index) => (
        <span
          key={index}
          className="flex-1 rounded-[2px]"
          style={{ height: `${Math.max(12, (value / max) * 100)}%`, background: stroke }}
        />
      ))}
    </span>
  );
}

export function DeveloperDashboardView({ data }: { data: DeveloperDashboard }) {
  const { productivity } = data;
  const chartMax = Math.max(...productivity.perDay.map((point) => point.value), 1);

  return (
    <section className="space-y-4">
      {/* Greeting band. The curve is decorative and sits behind the text. */}
      <div className={cn(panel, "relative overflow-hidden px-4 py-4 sm:px-5")}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-[26rem] rounded-full bg-[#2f6bff]/[0.12] blur-[70px]"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-vega-text-dim">
              Dashboard
            </p>
            <h1 className="mt-1 text-[24px] font-semibold leading-8 text-vega-text sm:text-[28px]">
              {greeting(new Date())}, {data.greetingName} <span aria-hidden="true">👋</span>
            </h1>
            <p className="mt-0.5 text-sm text-vega-text-muted">{data.headline}</p>
          </div>
          <div className="min-w-0 max-w-[15rem] text-right">
            <p className="text-[12.5px] italic leading-relaxed text-vega-text-secondary">
              &ldquo;{data.quote.text}&rdquo;
            </p>
            <p className="mt-1 text-[11px] text-vega-text-dim">{data.quote.footer} 🚀</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {data.metrics.map((metric) => {
          const Icon = METRIC_ICONS[metric.key as keyof typeof METRIC_ICONS] ?? ListTodo;
          const tone = TONES[metric.tone];

          return (
            <div key={metric.key} className={cn(panel, "min-w-0 p-3.5")}>
              <div className="flex items-start gap-3">
                <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", tone.tile)}>
                  <Icon className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] text-vega-text-muted">{metric.label}</p>
                  <p className="mt-0.5 truncate text-[24px] font-bold leading-8 text-vega-text">
                    {metric.value}
                  </p>
                </div>
              </div>
              <div className="mt-1.5 flex items-end justify-between gap-2">
                {/* Two cards across a phone leave no room for the full phrase,
                    and the sparkline beside it already says "over time". */}
                <p className="min-w-0 truncate text-[11px] text-vega-text-dim">
                  {metric.hint ?? (
                    <>
                      {metric.delta >= 0 ? "+" : ""}
                      {metric.delta}
                      <span className="hidden sm:inline"> from yesterday</span>
                    </>
                  )}
                </p>
                {metric.shape === "bars" ? (
                  <SparkBars series={metric.series} stroke={tone.stroke} />
                ) : (
                  <Sparkline series={metric.series} stroke={tone.stroke} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {data.lists.map((list) => {
          const { icon: Icon, tone } = LIST_ICONS[list.icon];

          return (
            <div key={list.title} className={cn(panel, "flex min-w-0 flex-col p-4")}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2.5">
                  <Icon className={cn("h-[18px] w-[18px] shrink-0", tone)} strokeWidth={2} aria-hidden="true" />
                  <h2 className="truncate text-[15px] font-semibold text-vega-text">{list.title}</h2>
                </span>
                <Link
                  href={list.href}
                  className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-vega-accent hover:text-vega-accent-hover"
                >
                  View all
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                </Link>
              </div>

              {list.items.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 py-7 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-vega-surface-2 text-vega-text-muted">
                    <CalendarDays className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <p className="text-[13px] text-vega-text-secondary">{list.emptyText}</p>
                  {list.emptySubtext ? (
                    <p className="text-[11.5px] text-vega-text-muted">{list.emptySubtext} 🎉</p>
                  ) : null}
                </div>
              ) : (
                <ul className="divide-y divide-vega-border-soft">
                  {list.items.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="flex items-center gap-3 py-2.5 transition-colors hover:bg-vega-surface-hover"
                      >
                        <span
                          className="h-[18px] w-[18px] shrink-0 rounded-full border border-vega-border-strong"
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-vega-text">
                          {item.title}
                        </span>
                        {item.tone === "danger" ? (
                          <span className="shrink-0 rounded-md border border-vega-red/35 bg-vega-red/10 px-2 py-0.5 text-[10px] font-medium text-[#f47171]">
                            Overdue
                          </span>
                        ) : null}
                        {item.meta ? (
                          <span className="shrink-0 text-[11.5px] text-vega-text-dim">{item.meta}</span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 xl:grid-cols-[0.85fr_1.15fr]">
        <div className={cn(panel, "min-w-0 p-4")}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2.5">
              <CalendarDays className="h-[18px] w-[18px] shrink-0 text-[#a98bff]" strokeWidth={2} aria-hidden="true" />
              <h2 className="truncate text-[15px] font-semibold text-vega-text">Today&apos;s schedule</h2>
            </span>
            <Link
              href="/calendar"
              className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-vega-accent hover:text-vega-accent-hover"
            >
              View calendar
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            </Link>
          </div>

          {data.schedule.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-vega-text-muted">
              Nothing scheduled today.
            </p>
          ) : (
            <ul className="space-y-0">
              {data.schedule.map((slot, index) => (
                <li key={slot.id} className="flex gap-3.5">
                  <span className="w-[68px] shrink-0 pt-2.5 text-right text-[12px] text-vega-text-muted">
                    {slot.time}
                  </span>
                  <span className="relative flex w-3 shrink-0 justify-center" aria-hidden="true">
                    <span
                      className={cn(
                        "absolute top-0 w-px bg-vega-border",
                        index === 0 ? "top-3.5" : "top-0",
                        index === data.schedule.length - 1 ? "h-3.5" : "h-full",
                      )}
                    />
                    <span
                      className={cn(
                        "relative mt-3 h-2.5 w-2.5 rounded-full",
                        index === 0 ? "bg-vega-accent" : "bg-vega-border-strong",
                      )}
                    />
                  </span>
                  <span className="min-w-0 flex-1 pb-4 pt-2">
                    <span className="block truncate text-[13.5px] font-medium text-vega-text">
                      {slot.title}
                    </span>
                    <span className="block truncate text-[12px] text-vega-text-muted">{slot.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={cn(panel, "min-w-0 p-4")}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2.5">
              <ChartNoAxesColumn className="h-[18px] w-[18px] shrink-0 text-[#6da2ff]" strokeWidth={2} aria-hidden="true" />
              <h2 className="truncate text-[15px] font-semibold text-vega-text">Productivity summary</h2>
            </span>
            <span className="shrink-0 rounded-lg border border-vega-border bg-vega-surface-2 px-2.5 py-1 text-[11.5px] text-vega-text-secondary">
              Last 7 days
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
            <div className="flex min-w-0 items-end gap-2.5">
              <div className="flex h-[132px] flex-col justify-between py-0.5 text-[10px] text-vega-text-dim">
                {axisTicks(chartMax).map((value) => (
                  <span key={value}>{value}</span>
                ))}
              </div>
              <div className="flex h-[132px] min-w-0 flex-1 items-end gap-1.5">
                {productivity.perDay.map((point) => (
                  <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                    <div
                      className="w-full rounded-t-[3px] bg-vega-accent"
                      style={{ height: `${Math.max(3, (point.value / chartMax) * 108)}px` }}
                      title={`${point.label}: ${point.value}`}
                    />
                    <span className="text-[10px] text-vega-text-dim">{point.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <ul className="min-w-0 space-y-3">
              <li className="flex items-center gap-2.5">
                <CircleCheck className="h-[18px] w-[18px] shrink-0 text-[#6da2ff]" strokeWidth={2} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-[17px] font-bold leading-6 text-vega-text">
                    {productivity.completed}
                  </span>
                  <span className="block text-[11.5px] text-vega-text-muted">Tasks completed</span>
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <Clock className="h-[18px] w-[18px] shrink-0 text-[#a98bff]" strokeWidth={2} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-[17px] font-bold leading-6 text-vega-text">
                    {hoursAndMinutes(productivity.workedMinutes)}
                  </span>
                  <span className="block text-[11.5px] text-vega-text-muted">Total work time</span>
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <ChartNoAxesColumn className="h-[18px] w-[18px] shrink-0 text-[#5fd88c]" strokeWidth={2} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-[17px] font-bold leading-6 text-vega-text">
                    {productivity.ratePercent === null ? "--" : `${productivity.ratePercent}%`}
                  </span>
                  <span className="block text-[11.5px] text-vega-text-muted">
                    {productivity.ratePercent === null ? "Nothing was due" : "Of what was due, done"}
                  </span>
                </span>
              </li>
              {productivity.deltaPercent !== null ? (
                <li className="flex items-center gap-2.5">
                  <TrendingUp
                    className={cn(
                      "h-[18px] w-[18px] shrink-0",
                      productivity.deltaPercent >= 0 ? "text-[#5fd88c]" : "rotate-180 text-[#f47171]",
                    )}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "block text-[17px] font-bold leading-6",
                        productivity.deltaPercent >= 0 ? "text-[#5fd88c]" : "text-[#f47171]",
                      )}
                    >
                      {productivity.deltaPercent >= 0 ? "+" : ""}
                      {productivity.deltaPercent}%
                    </span>
                    <span className="block text-[11.5px] text-vega-text-muted">vs. last week</span>
                  </span>
                </li>
              ) : null}
            </ul>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-vega-border-soft bg-vega-surface-2 px-3.5 py-2.5">
            <p className="min-w-0 text-[12.5px] italic text-vega-text-secondary">
              &ldquo;{data.quote.text}&rdquo;
            </p>
            <p className="shrink-0 text-[11.5px] text-vega-text-muted">{data.quote.footer} 💙</p>
          </div>
        </div>
      </div>
    </section>
  );
}
