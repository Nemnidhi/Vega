import Link from "next/link";
import {
  ArrowUp,
  Building2,
  CalendarDays,
  ChevronDown,
  SquareCheckBig,
  Users,
} from "lucide-react";
import { getHomeDashboard, type HomeSeriesPoint, type HomeSlice } from "@/lib/dashboard/home";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { cn } from "@/lib/utils/cn";

export const dynamic = "force-dynamic";

const panel = "rounded-xl border border-vega-border bg-vega-surface-1";

const statIcons = {
  leads: Users,
  clients: Building2,
  meetings: CalendarDays,
  tasks: SquareCheckBig,
} as const;

const statTints = {
  leads: "bg-vega-accent-soft text-[#93c5fd]",
  clients: "bg-[#a855f71f] text-[#c084fc]",
  meetings: "bg-vega-cyan-soft text-[#67e8f9]",
  tasks: "bg-vega-accent-soft text-[#93c5fd]",
} as const;

const sliceColors = ["#3b82f6", "#a855f7", "#22c55e", "#eab308", "#64748b"];
const taskStatusColors: Record<string, string> = {
  Completed: "#22c55e",
  "In Progress": "#3b82f6",
  Pending: "#eab308",
  Overdue: "#ef4444",
};

function greeting(now: Date) {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function relativeTime(value: string | null) {
  if (!value) return "";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Rounds a maximum up to a clean axis top so the gridline labels stay readable. */
function axisMax(values: number[]) {
  const peak = Math.max(...values, 1);
  const step = Math.pow(10, Math.floor(Math.log10(peak)));
  return Math.max(step, Math.ceil(peak / step) * step);
}

/**
 * Smooth area chart, drawn inline rather than through a charting library - the project has no
 * chart dependency and this is six points of data, so a path is cheaper than shipping one.
 */
function AreaChart({ points }: { points: HomeSeriesPoint[] }) {
  const width = 520;
  const height = 210;
  const padding = { top: 10, right: 8, bottom: 24, left: 30 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const max = axisMax(points.map((point) => point.value));
  const gridValues = [0, max * 0.2, max * 0.4, max * 0.6, max * 0.8, max];

  const coords = points.map((point, index) => ({
    x: padding.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth),
    y: padding.top + plotHeight - (point.value / max) * plotHeight,
  }));

  // Catmull-Rom control points, so the line curves the way the mockup's does instead of
  // showing hard corners at every month.
  const line = coords
    .map((point, index, all) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      const previous = all[index - 1];
      const controlX = (previous.x + point.x) / 2;
      return `C ${controlX} ${previous.y} ${controlX} ${point.y} ${point.x} ${point.y}`;
    })
    .join(" ");
  const area = `${line} L ${coords[coords.length - 1].x} ${padding.top + plotHeight} L ${coords[0].x} ${padding.top + plotHeight} Z`;

  const peakIndex = points.reduce((best, point, index) => (point.value > points[best].value ? index : best), 0);
  const peak = coords[peakIndex];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[210px] w-full" role="img" aria-label="Leads over the last six months">
      <defs>
        <linearGradient id="leads-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {gridValues.map((value) => {
        const y = padding.top + plotHeight - (value / max) * plotHeight;
        return (
          <g key={value}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#1c2936" strokeWidth="1" />
            <text x={padding.left - 8} y={y + 3} textAnchor="end" className="fill-[#657385] text-[9px]">
              {Math.round(value)}
            </text>
          </g>
        );
      })}

      <path d={area} fill="url(#leads-area)" />
      <path d={line} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={peak.x} cy={peak.y} r="4.5" fill="#3b82f6" stroke="#0d1620" strokeWidth="2.5" />

      {points.map((point, index) => (
        <text key={point.label} x={coords[index].x} y={height - 6} textAnchor="middle" className="fill-[#657385] text-[9px]">
          {point.label}
        </text>
      ))}
    </svg>
  );
}

function BarChart({ points }: { points: HomeSeriesPoint[] }) {
  const max = axisMax(points.map((point) => point.value));

  return (
    <div className="flex items-end gap-3">
      <div className="flex h-[150px] flex-col justify-between py-0.5 text-[9px] text-vega-text-dim">
        {[max, max * 0.75, max * 0.5, max * 0.25, 0].map((value) => (
          <span key={value}>{Math.round(value)}</span>
        ))}
      </div>
      <div className="flex h-[150px] min-w-0 flex-1 items-end gap-2">
        {points.map((point) => (
          <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <div
              className="w-full rounded-t-[3px] bg-vega-accent"
              style={{ height: `${Math.max(2, (point.value / max) * 128)}px` }}
              title={`${point.label}: ${point.value}`}
            />
            <span className="text-[9px] text-vega-text-dim">{point.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Donut({
  slices,
  total,
  caption,
  colorFor,
}: {
  slices: HomeSlice[];
  total: number;
  caption: string;
  colorFor: (slice: HomeSlice, index: number) => string;
}) {
  let cursor = 0;
  const stops =
    total > 0
      ? slices
          .map((slice, index) => {
            const start = cursor;
            cursor += (slice.value / total) * 100;
            return `${colorFor(slice, index)} ${start}% ${cursor}%`;
          })
          .join(", ")
      : "#1a3044 0% 100%";

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-[132px] w-[132px] shrink-0 rounded-full" style={{ background: `conic-gradient(${stops})` }}>
        <div className="absolute inset-[26px] flex flex-col items-center justify-center rounded-full bg-vega-surface-1">
          <strong className="text-xl font-semibold text-vega-text">{total}</strong>
          <span className="text-[9px] text-vega-text-muted">{caption}</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2 text-xs">
        {slices.map((slice, index) => (
          <li key={slice.label} className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorFor(slice, index) }} />
            <span className="min-w-0 flex-1 truncate text-vega-text-secondary">{slice.label}</span>
            <span className="shrink-0 font-medium text-vega-text">{slice.percent}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function priorityClass(priority: string) {
  if (priority === "High" || priority === "Urgent") return "bg-vega-red-soft text-[#ff8b93]";
  if (priority === "Low") return "bg-vega-green-soft text-[#62df90]";
  return "bg-vega-yellow-soft text-[#f0cc61]";
}

export default async function DashboardPage() {
  const session = await requireRoleAccess(["admin", "sales", "digital_marketing"], {
    redirectTo: "/tasks",
  });
  const data = await getHomeDashboard();
  const firstName = (session.fullName ?? session.email).split(/\s+/)[0];
  const todaysTotal = data.todaysTasks.length;
  const todaysPercent = todaysTotal > 0 ? Math.round((data.todaysTasksCompleted / todaysTotal) * 100) : 0;

  return (
    <section className="min-w-0 lg:grid lg:grid-cols-[minmax(0,1fr)_330px] lg:items-start lg:gap-4">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-[26px] font-semibold leading-8 text-vega-text lg:text-[28px]">
              {greeting(new Date())}, {firstName} <span aria-hidden="true">👋</span>
            </h1>
            <p className="mt-1 text-sm text-vega-text-muted">Here&apos;s what&apos;s happening with your business today.</p>
          </div>
          <div className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-vega-border bg-vega-surface-1 px-3 text-[13px] font-medium text-vega-text-secondary">
            <CalendarDays className="h-4 w-4 text-vega-text-muted" strokeWidth={1.8} aria-hidden="true" />
            <span>{data.rangeLabel}</span>
            <ChevronDown className="h-4 w-4 text-vega-text-muted" strokeWidth={1.8} aria-hidden="true" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {data.stats.map((stat) => {
            const Icon = statIcons[stat.key];
            const positive = stat.deltaPercent >= 0;

            return (
              <div key={stat.key} className={cn(panel, "p-4")}>
                <div className="flex items-start gap-3">
                  <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg", statTints[stat.key])}>
                    <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-vega-text-muted">{stat.label}</p>
                    <p className="mt-1 text-[28px] font-semibold leading-8 text-vega-text">{stat.value}</p>
                  </div>
                </div>
                <p className={cn("mt-3 flex items-center gap-1 text-xs font-medium", positive ? "text-vega-green" : "text-vega-red")}>
                  <ArrowUp className={cn("h-3.5 w-3.5", !positive && "rotate-180")} strokeWidth={2} aria-hidden="true" />
                  {positive ? "+" : ""}{stat.deltaPercent}%
                </p>
                <p className="text-[11px] text-vega-text-dim">vs last month</p>
              </div>
            );
          })}
        </div>

        <div className="grid gap-3 xl:grid-cols-[1.35fr_1fr]">
          <div className={cn(panel, "p-4")}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-vega-text">Leads Overview</h2>
              <span className="flex h-8 items-center gap-2 rounded-lg border border-vega-border bg-vega-surface-2 px-3 text-[11px] text-vega-text-secondary">
                Last 6 months
                <ChevronDown className="h-3.5 w-3.5 text-vega-text-muted" strokeWidth={1.8} aria-hidden="true" />
              </span>
            </div>
            <AreaChart points={data.leadsOverview} />
          </div>

          <div className={cn(panel, "flex flex-col p-4")}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-vega-text">Recent Activity</h2>
              <Link href="/tasks" className="text-xs font-medium text-vega-accent hover:text-vega-accent-hover">
                View all
              </Link>
            </div>
            <ul className="space-y-3.5">
              {data.recentActivity.map((item) => (
                <li key={item.id} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-vega-accent-soft text-[10px] font-semibold uppercase text-[#93c5fd]">
                    {item.detail.slice(0, 2)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-vega-text">{item.title}</span>
                    <span className="block truncate text-[11px] text-vega-text-muted">{item.detail}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-vega-text-dim">{relativeTime(item.createdAt)}</span>
                </li>
              ))}
              {data.recentActivity.length === 0 ? (
                <li className="py-6 text-center text-xs text-vega-text-muted">No activity recorded yet.</li>
              ) : null}
            </ul>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className={cn(panel, "p-4")}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-vega-text">Lead Sources</h2>
              <span className="flex h-8 items-center gap-2 rounded-lg border border-vega-border bg-vega-surface-2 px-3 text-[11px] text-vega-text-secondary">
                All time
                <ChevronDown className="h-3.5 w-3.5 text-vega-text-muted" strokeWidth={1.8} aria-hidden="true" />
              </span>
            </div>
            <Donut
              slices={data.leadSources}
              total={data.totalLeadsInSources}
              caption="Total Leads"
              colorFor={(_slice, index) => sliceColors[index % sliceColors.length]}
            />
          </div>

          <div className={cn(panel, "p-4")}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-vega-text">Client Growth</h2>
              <span className="flex items-center gap-1 text-xs font-medium text-vega-green">
                <ArrowUp className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                {data.stats[1].deltaPercent >= 0 ? "+" : ""}{data.stats[1].deltaPercent}%
              </span>
            </div>
            <BarChart points={data.clientGrowth} />
          </div>

          <div className={cn(panel, "p-4 md:col-span-2 xl:col-span-1")}>
            <h2 className="mb-3 text-[15px] font-semibold text-vega-text">Task Status</h2>
            <Donut
              slices={data.taskStatus}
              total={data.totalTasksInStatus}
              caption="Total Tasks"
              colorFor={(slice) => taskStatusColors[slice.label] ?? "#64748b"}
            />
          </div>
        </div>
      </div>

      <div className="mt-3 min-w-0 space-y-3 lg:mt-0">
        <div className={cn(panel, "p-4")}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-vega-text">Upcoming Meetings</h2>
            <Link href="/meetings" className="text-xs font-medium text-vega-accent hover:text-vega-accent-hover">
              View all
            </Link>
          </div>
          <ul className="space-y-2">
            {data.upcomingMeetings.map((meeting) => (
              <li key={meeting.id} className="flex items-start gap-3 border-b border-vega-border-soft pb-2.5 last:border-b-0 last:pb-0">
                <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-vega-surface-2">
                  <span className="text-sm font-semibold leading-4 text-vega-text">{meeting.day}</span>
                  <span className="text-[9px] leading-3 text-vega-text-muted">{meeting.month}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-vega-text">{meeting.title}</span>
                  <span className="block truncate text-[11px] text-vega-text-muted">{meeting.timeRange}</span>
                  <span className="block truncate text-[11px] text-vega-text-dim">{meeting.purpose}</span>
                </span>
              </li>
            ))}
            {data.upcomingMeetings.length === 0 ? (
              <li className="py-6 text-center text-xs text-vega-text-muted">No meetings scheduled.</li>
            ) : null}
          </ul>
        </div>

        <div className={cn(panel, "p-4")}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-vega-text">Today&apos;s Tasks</h2>
            <Link href="/tasks" className="text-xs font-medium text-vega-accent hover:text-vega-accent-hover">
              View all
            </Link>
          </div>
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-vega-text-muted">
              {data.todaysTasksCompleted} of {todaysTotal} completed
            </span>
            <span className="font-medium text-vega-text">{todaysPercent}%</span>
          </div>
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-vega-surface-2">
            <div className="h-full rounded-full bg-vega-accent" style={{ width: `${todaysPercent}%` }} />
          </div>
          <ul className="space-y-2.5">
            {data.todaysTasks.map((task) => (
              <li key={task.id} className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border",
                    task.completed ? "border-vega-accent bg-vega-accent" : "border-vega-border-strong",
                  )}
                  aria-hidden="true"
                >
                  {task.completed ? (
                    <svg viewBox="0 0 12 12" className="h-3 w-3 fill-none stroke-white stroke-2">
                      <path d="M2.5 6.2 4.8 8.5 9.5 3.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : null}
                </span>
                <Link
                  href={`/tasks/${task.id}`}
                  className={cn(
                    "min-w-0 flex-1 truncate text-[13px]",
                    task.completed ? "text-vega-text-muted line-through" : "text-vega-text-secondary hover:text-vega-text",
                  )}
                >
                  {task.title}
                </Link>
                <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium", priorityClass(task.priority))}>
                  {task.priority}
                </span>
              </li>
            ))}
            {data.todaysTasks.length === 0 ? (
              <li className="py-6 text-center text-xs text-vega-text-muted">Nothing due today.</li>
            ) : null}
          </ul>
        </div>
      </div>
    </section>
  );
}
