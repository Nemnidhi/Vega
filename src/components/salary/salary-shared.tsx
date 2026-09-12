import { IndianRupee } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SalaryDayCategory, SalaryDayEntry } from "@/lib/salary/calculator";
import { cn } from "@/lib/utils/cn";

export const panel = "rounded-lg border border-vega-border bg-vega-surface-1";
export const parseDate = (key: string) => new Date(`${key}T00:00:00`);

export function monthLabel(key: string) {
  return /^\d{4}-\d{2}$/.test(key) ? parseDate(`${key}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "--";
}
export function shiftMonth(key: string, amount: number) {
  const value = parseDate(`${key}-01`);
  value.setMonth(value.getMonth() + amount);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}
export function currency(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}
export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}
export function categoryBadge(category: SalaryDayCategory) {
  if (category === "worked") return { label: "Present", variant: "success" as const };
  if (category === "late_coming") return { label: "Late", variant: "warning" as const };
  if (category === "half_day") return { label: "Half day", variant: "warning" as const };
  if (category === "paid_leave") return { label: "Paid leave", variant: "accent" as const };
  if (category === "unpaid_leave") return { label: "Unpaid leave", variant: "danger" as const };
  if (category === "absent") return { label: "Absent", variant: "danger" as const };
  if (category === "holiday") return { label: "Holiday", variant: "neutral" as const };
  if (category === "weekend") return { label: "Weekend", variant: "neutral" as const };
  return { label: "Upcoming", variant: "neutral" as const };
}

export function Avatar({ name, index = 0 }: { name: string; index?: number }) {
  const colors = ["bg-[#4338a5]", "bg-[#2563a8]", "bg-[#147a6b]", "bg-[#8b3f75]", "bg-[#8a6423]"];
  return (
    <span className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white", colors[index % colors.length])}>
      {initials(name)}
    </span>
  );
}

export function Metric({ label, value, tone = "blue" }: { label: string; value: string; tone?: "blue" | "green" | "red" | "neutral" }) {
  const color = { blue: "bg-vega-blue-soft text-[#5da2ff]", green: "bg-vega-green-soft text-[#55df89]", red: "bg-vega-red-soft text-[#ff6872]", neutral: "bg-[#172536] text-[#b8c8dc]" }[tone];
  return (
    <div className={cn(panel, "flex min-h-[74px] items-center gap-3 px-4 py-3")}>
      <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full", color)}>
        <IndianRupee className="h-5 w-5" strokeWidth={1.8} />
      </span>
      <div>
        <p className="text-[11px] text-vega-text-muted">{label}</p>
        <p className="mt-0.5 text-xl font-semibold leading-none text-vega-text">{value}</p>
      </div>
    </div>
  );
}

export function DayBreakdown({ days }: { days: SalaryDayEntry[] }) {
  const relevant = days.filter((day) => day.category !== "weekend" && day.category !== "future");
  return (
    <div className="flex flex-wrap gap-1.5">
      {relevant.map((day) => {
        const badge = categoryBadge(day.category);
        return (
          <span key={day.dateKey} className="inline-flex items-center gap-1.5 rounded-md border border-vega-border bg-vega-surface-1 px-2 py-1 text-[10px]" title={day.note}>
            <span className="text-vega-text-muted">{day.dateKey.slice(-2)}</span>
            <Badge variant={badge.variant} className="text-[9px]">
              {badge.label}
            </Badge>
          </span>
        );
      })}
      {relevant.length === 0 ? <p className="text-xs text-vega-text-muted">No working days marked yet this month.</p> : null}
    </div>
  );
}
