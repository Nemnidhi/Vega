"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SalaryMonthDetail } from "@/lib/salary/calculator";
import { cn } from "@/lib/utils/cn";
import { DayBreakdown, Metric, currency, monthLabel, panel, shiftMonth } from "@/components/salary/salary-shared";

type ApiResponse = { success: boolean; data?: unknown; error?: { message?: string } };

interface SalaryEmployeeViewProps {
  initialMonthKey: string;
  initialDetail: SalaryMonthDetail | null;
}

export function SalaryEmployeeView({ initialMonthKey, initialDetail }: SalaryEmployeeViewProps) {
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [detail, setDetail] = useState(initialDetail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMonth(nextMonth: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/salary/month?month=${nextMonth}`, { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error?.message ?? "Unable to load salary.");
      setMonthKey(nextMonth);
      setDetail(payload.data as SalaryMonthDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load salary.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="min-w-0 space-y-4">
      <div>
        <h1 className="text-[26px] font-semibold leading-8 text-vega-text lg:text-[28px]">My Salary</h1>
        <p className="mt-0.5 text-xs text-vega-text-muted lg:text-sm">Your pay for the month, computed from attendance and approved leave.</p>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => void loadMonth(shiftMonth(monthKey, -1))} disabled={loading} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-vega-border text-vega-text-secondary hover:bg-vega-surface-hover" aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <label className="relative flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-vega-border bg-[#0b141f] px-3 text-xs font-medium text-vega-text sm:min-w-[220px] sm:flex-none">
          <CalendarDays className="h-4 w-4 text-vega-text-muted" />
          <span className="truncate">{monthLabel(monthKey)}</span>
          <input className="absolute inset-0 cursor-pointer opacity-0" type="month" value={monthKey} onChange={(event) => void loadMonth(event.target.value)} />
        </label>
        <button type="button" onClick={() => void loadMonth(shiftMonth(monthKey, 1))} disabled={loading} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-vega-border text-vega-text-secondary hover:bg-vega-surface-hover" aria-label="Next month">
          <ChevronRight className="h-4 w-4" />
        </button>
        <Button variant="secondary" className="hidden sm:inline-flex" onClick={() => void loadMonth(initialMonthKey)}>
          Current month
        </Button>
        <button type="button" onClick={() => void loadMonth(monthKey)} className="ml-auto inline-flex items-center gap-2 text-xs text-vega-text-muted">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {error ? <div className="rounded-md border border-vega-red/40 bg-vega-red-soft px-3 py-2 text-xs text-[#ff838b]">{error}</div> : null}

      {!detail?.baseSalary ? (
        <div className={cn(panel, "p-4 text-xs text-vega-text-muted")}>Your base salary hasn&apos;t been set yet - ask an admin to configure it.</div>
      ) : (
        <>
          <div className="flex justify-end">
            <a
              href={`/api/salary/pdf?month=${monthKey}`}
              download
              className="inline-flex items-center gap-2 rounded-md border border-vega-border bg-vega-surface-1 px-3 py-1.5 text-xs font-medium text-vega-text-secondary hover:border-vega-accent-border hover:text-vega-text"
            >
              <Download className="h-3.5 w-3.5" />
              Download payslip
            </a>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="Base salary" value={currency(detail.baseSalary)} tone="blue" />
            <Metric label="Deducted" value={currency(detail.deductionAmount)} tone="red" />
            <Metric label="Net pay" value={currency(detail.netPay)} tone="green" />
            <Metric label="Late (this month)" value={String(detail.lateComingDays)} tone="neutral" />
          </div>
          <div className={cn(panel, "p-4")}>
            <h2 className="mb-3 text-sm font-semibold text-vega-text">Day-by-day</h2>
            <DayBreakdown days={detail.days} />
          </div>
        </>
      )}
    </section>
  );
}
