"use client";

import { Fragment, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Download, IndianRupee, RefreshCw, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SalaryDayCategory, SalaryDayEntry, SalaryMonthDetail, SalaryMonthSummary } from "@/lib/salary/calculator";
import { cn } from "@/lib/utils/cn";

type ApiResponse = { success: boolean; data?: unknown; error?: { message?: string } };
type Notice = { tone: "success" | "error"; text: string };

interface SalaryAdminDeskProps {
  initialMonthKey: string;
  initialRows: SalaryMonthSummary[];
}

const panel = "rounded-lg border border-vega-border bg-vega-surface-1";
const parseDate = (key: string) => new Date(`${key}T00:00:00`);

function monthLabel(key: string) {
  return /^\d{4}-\d{2}$/.test(key) ? parseDate(`${key}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "--";
}
function shiftMonth(key: string, amount: number) {
  const value = parseDate(`${key}-01`);
  value.setMonth(value.getMonth() + amount);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}
function currency(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}
function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}
function categoryBadge(category: SalaryDayCategory) {
  if (category === "worked") return { label: "Present", variant: "success" as const };
  if (category === "half_day") return { label: "Half day", variant: "warning" as const };
  if (category === "paid_leave") return { label: "Paid leave", variant: "accent" as const };
  if (category === "unpaid_leave") return { label: "Unpaid leave", variant: "danger" as const };
  if (category === "absent") return { label: "Absent", variant: "danger" as const };
  if (category === "holiday") return { label: "Holiday", variant: "neutral" as const };
  if (category === "weekend") return { label: "Weekend", variant: "neutral" as const };
  return { label: "Upcoming", variant: "neutral" as const };
}

function Avatar({ name, index = 0 }: { name: string; index?: number }) {
  const colors = ["bg-[#4338a5]", "bg-[#2563a8]", "bg-[#147a6b]", "bg-[#8b3f75]", "bg-[#8a6423]"];
  return (
    <span className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white", colors[index % colors.length])}>
      {initials(name)}
    </span>
  );
}

function Metric({ label, value, tone = "blue" }: { label: string; value: string; tone?: "blue" | "green" | "red" | "neutral" }) {
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

export function SalaryAdminDesk({ initialMonthKey, initialRows }: SalaryAdminDeskProps) {
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [rows, setRows] = useState(initialRows);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [detailByUser, setDetailByUser] = useState<Record<string, SalaryMonthDetail>>({});
  const [baseSalaryDrafts, setBaseSalaryDrafts] = useState<Record<string, string>>({});

  async function loadMonth(nextMonth: string) {
    const response = await fetch(`/api/salary/admin/month?month=${nextMonth}`, { cache: "no-store" });
    const payload = (await response.json()) as ApiResponse;
    if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error?.message ?? "Unable to load salary data.");
    const parsed = payload.data as { monthKey: string; rows: SalaryMonthSummary[] };
    setMonthKey(parsed.monthKey);
    setRows(parsed.rows);
    setExpandedUserId(null);
    setDetailByUser({});
  }

  async function refreshMonth(key = monthKey) {
    setLoadingKey("month-refresh");
    setNotice(null);
    try {
      await loadMonth(key);
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to load salary data." });
    } finally {
      setLoadingKey(null);
    }
  }

  async function toggleExpand(userId: string) {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      return;
    }
    setExpandedUserId(userId);
    if (detailByUser[userId]) return;

    setLoadingKey(`detail-${userId}`);
    setNotice(null);
    try {
      const response = await fetch(`/api/salary/admin/month/${userId}?month=${monthKey}`, { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error?.message ?? "Unable to load breakdown.");
      setDetailByUser((current) => ({ ...current, [userId]: payload.data as SalaryMonthDetail }));
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to load breakdown." });
    } finally {
      setLoadingKey(null);
    }
  }

  async function saveBaseSalary(userId: string) {
    const draft = baseSalaryDrafts[userId];
    const baseSalary = Number(draft);
    if (!draft || !Number.isFinite(baseSalary) || baseSalary < 0) {
      setNotice({ tone: "error", text: "Enter a valid base salary." });
      return;
    }

    setLoadingKey(`save-${userId}`);
    setNotice(null);
    try {
      const response = await fetch(`/api/salary/admin/base/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseSalary }),
      });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok || !payload.success) throw new Error(payload.error?.message ?? "Unable to save base salary.");
      await loadMonth(monthKey);
      setBaseSalaryDrafts((current) => {
        const next = { ...current };
        delete next[userId];
        return next;
      });
      setNotice({ tone: "success", text: "Base salary updated." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to save base salary." });
    } finally {
      setLoadingKey(null);
    }
  }

  function downloadCsv() {
    const csvRows: Array<Array<string | number>> = [
      ["Staff", "Base salary", "Worked", "Half day", "Paid leave", "Unpaid leave", "Absent", "Deduction", "Net pay"],
      ...rows.map((row) => [
        row.user.fullName,
        row.baseSalary ?? "not set",
        row.workedDays,
        row.halfDays,
        row.paidLeaveDays,
        row.unpaidLeaveDays,
        row.absentDays,
        row.deductionAmount,
        row.netPay,
      ]),
    ];
    const csv = csvRows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `salary-${monthKey}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.netPay += row.netPay;
          acc.deductionAmount += row.deductionAmount;
          if (row.baseSalary === null) acc.unconfigured += 1;
          return acc;
        },
        { netPay: 0, deductionAmount: 0, unconfigured: 0 },
      ),
    [rows],
  );

  return (
    <section className="min-w-0 space-y-4">
      <div className="mb-1 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold leading-8 text-vega-text lg:text-[28px]">Salary</h1>
          <p className="mt-0.5 text-xs text-vega-text-muted lg:text-sm">Monthly pay computed from attendance and approved leave.</p>
        </div>
        <Button size="lg" onClick={downloadCsv}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => void refreshMonth(shiftMonth(monthKey, -1))} disabled={loadingKey !== null} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-vega-border text-vega-text-secondary hover:bg-vega-surface-hover" aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <label className="relative flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-vega-border bg-[#0b141f] px-3 text-xs font-medium text-vega-text sm:min-w-[220px] sm:flex-none">
          <CalendarDays className="h-4 w-4 text-vega-text-muted" />
          <span className="truncate">{monthLabel(monthKey)}</span>
          <input className="absolute inset-0 cursor-pointer opacity-0" type="month" value={monthKey} onChange={(event) => void refreshMonth(event.target.value)} />
        </label>
        <button type="button" onClick={() => void refreshMonth(shiftMonth(monthKey, 1))} disabled={loadingKey !== null} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-vega-border text-vega-text-secondary hover:bg-vega-surface-hover" aria-label="Next month">
          <ChevronRight className="h-4 w-4" />
        </button>
        <Button variant="secondary" className="hidden sm:inline-flex" onClick={() => void refreshMonth(initialMonthKey)}>
          Current month
        </Button>
        <button type="button" onClick={() => void refreshMonth()} className="ml-auto inline-flex items-center gap-2 text-xs text-vega-text-muted">
          <RefreshCw className={cn("h-3.5 w-3.5", loadingKey === "month-refresh" && "animate-spin")} />
          Refresh
        </button>
      </div>

      {notice ? (
        <div className={cn("rounded-md border px-3 py-2 text-xs", notice.tone === "error" ? "border-vega-red/40 bg-vega-red-soft text-[#ff838b]" : "border-vega-green/35 bg-vega-green-soft text-[#6ce39a]")}>
          {notice.text}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Staff" value={String(rows.length)} tone="blue" />
        <Metric label="Total net pay" value={currency(totals.netPay)} tone="green" />
        <Metric label="Total deducted" value={currency(totals.deductionAmount)} tone="red" />
        <Metric label="Base salary not set" value={String(totals.unconfigured)} tone="neutral" />
      </div>

      <div className={cn(panel, "overflow-hidden")}>
        <div className="flex items-center justify-between border-b border-vega-border px-4 py-3">
          <h2 className="text-base font-semibold text-vega-text">Team salary</h2>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-vega-text-muted">
            <UsersRound className="h-3.5 w-3.5" />
            {rows.length} staff
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] table-fixed text-left text-xs">
            <thead className="bg-[#0b151f] text-[11px] text-vega-text-muted">
              <tr>
                <th className="w-[22%] px-4 py-2.5 font-medium">Staff</th>
                <th className="w-[16%] px-3 py-2.5 font-medium">Base salary</th>
                <th className="px-3 py-2.5 font-medium">Present</th>
                <th className="px-3 py-2.5 font-medium">Half day</th>
                <th className="px-3 py-2.5 font-medium">Paid leave</th>
                <th className="px-3 py-2.5 font-medium">Unpaid / absent</th>
                <th className="px-3 py-2.5 font-medium">Deduction</th>
                <th className="px-3 py-2.5 font-medium">Net pay</th>
                <th className="w-10 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const draft = baseSalaryDrafts[row.user._id];
                const isExpanded = expandedUserId === row.user._id;
                const detail = detailByUser[row.user._id];
                return (
                  <Fragment key={row.user._id}>
                    <tr className="border-t border-vega-border-soft hover:bg-vega-surface-hover/50">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={row.user.fullName} index={index} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-vega-text">{row.user.fullName}</p>
                            <p className="truncate text-[10px] capitalize text-vega-text-muted">{row.user.role.replaceAll("_", " ")}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Input
                            inputMode="numeric"
                            className="h-8 w-24 text-xs"
                            placeholder={row.baseSalary !== null ? String(row.baseSalary) : "Not set"}
                            value={draft ?? ""}
                            onChange={(event) => setBaseSalaryDrafts((current) => ({ ...current, [row.user._id]: event.target.value }))}
                          />
                          {draft ? (
                            <Button size="sm" onClick={() => void saveBaseSalary(row.user._id)} disabled={loadingKey !== null}>
                              {loadingKey === `save-${row.user._id}` ? "..." : "Save"}
                            </Button>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-vega-text-secondary">{row.workedDays}</td>
                      <td className="px-3 py-2.5 text-vega-text-secondary">{row.halfDays}</td>
                      <td className="px-3 py-2.5 text-vega-text-secondary">{row.paidLeaveDays}</td>
                      <td className="px-3 py-2.5 text-vega-text-secondary">{row.unpaidLeaveDays + row.absentDays}</td>
                      <td className="px-3 py-2.5 text-vega-red">{row.deductionAmount > 0 ? `-${currency(row.deductionAmount)}` : "--"}</td>
                      <td className="px-3 py-2.5 font-semibold text-vega-text">{row.baseSalary !== null ? currency(row.netPay) : "--"}</td>
                      <td className="px-3 py-2.5">
                        <button type="button" onClick={() => void toggleExpand(row.user._id)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-vega-border text-vega-text-secondary" aria-label={`View breakdown for ${row.user.fullName}`}>
                          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-180")} />
                        </button>
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="border-t border-vega-border-soft bg-[#0b151f]">
                        <td colSpan={9} className="px-4 py-3">
                          {!detail ? (
                            <p className="text-xs text-vega-text-muted">{loadingKey === `detail-${row.user._id}` ? "Loading breakdown..." : "No data."}</p>
                          ) : (
                            <DayBreakdown days={detail.days} />
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function DayBreakdown({ days }: { days: SalaryDayEntry[] }) {
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
