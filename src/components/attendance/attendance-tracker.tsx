"use client";

import { type ComponentType, useEffect, useMemo, useState } from "react";
import {
  AlarmClock,
  ChevronRight,
  CircleCheck,
  CalendarDays,
  CalendarX,
  Clock,
  Coffee,
  Contrast,
  FileText,
  LogIn,
  LogOut,
  Play,
  RefreshCw,
  Square,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import type {
  AttendancePayload,
  AttendanceRecord,
  BreakSessionRecord,
} from "@/lib/attendance/queries";

type ApiResponse = {
  success: boolean;
  data?: unknown;
  error?: {
    message?: string;
  };
};

type Notice = {
  tone: "success" | "error";
  text: string;
};

type AttendanceLocationPayload = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};


/**
 * The summary always covers the current month - the query takes no month
 * argument - so this is a label, not a picker. Rendered without a chevron for
 * that reason: a dropdown arrow on something that cannot be opened is a lie.
 */
function monthLabel() {
  return new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function dayOfMonth(dateKey?: string) {
  if (!dateKey) return "--";
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit" });
}

function monthAndYear(dateKey?: string) {
  if (!dateKey) return "";
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
}

function formatFullDate(dateKey?: string) {
  const date = dateKey ? new Date(`${dateKey}T00:00:00`) : new Date();
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value?: string | null) {
  if (!value) {
    return "--";
  }
  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMinutesAsHours(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return "0h 00m";
  }
  const wholeHours = Math.floor(minutes / 60);
  const remainderMinutes = minutes % 60;
  return `${wholeHours}h ${String(remainderMinutes).padStart(2, "0")}m`;
}

function calculateMinutesBetween(startAt: Date, endAt: Date) {
  const minutes = Math.floor((endAt.getTime() - startAt.getTime()) / 60000);
  return Math.max(0, minutes);
}

function calculateActiveBreakMinutes(
  breakSessions: BreakSessionRecord[],
  now: Date,
) {
  return breakSessions.reduce((total, session) => {
    if (!session.startAt || session.endAt) {
      return total;
    }

    return total + calculateMinutesBetween(new Date(session.startAt), now);
  }, 0);
}

function getLiveWorkedMinutes(
  entry: AttendanceRecord | null,
  breakSessions: BreakSessionRecord[],
  now: Date,
) {
  if (!entry?.checkInAt) {
    return entry?.workedMinutes ?? 0;
  }

  if (entry.checkOutAt) {
    return entry.workedMinutes ?? 0;
  }

  const elapsedMinutes = calculateMinutesBetween(new Date(entry.checkInAt), now);
  const completedBreakMinutes = entry.totalBreakMinutes ?? 0;
  const activeBreakMinutes = calculateActiveBreakMinutes(breakSessions, now);
  return Math.max(0, elapsedMinutes - completedBreakMinutes - activeBreakMinutes);
}

/** Rows shown before "View all" is used. */
const VISIBLE_ENTRIES = 6;

function statusFromEntry(entry: AttendanceRecord | null) {
  if (!entry) {
    return { label: "Not Marked", variant: "warning" as const };
  }
  if (entry.dayStatus === "absent") {
    return { label: "Absent", variant: "danger" as const };
  }
  if (entry.dayStatus === "half_day") {
    return { label: "Half Day", variant: "warning" as const };
  }
  if (entry.dayStatus === "late_coming") {
    return { label: "Late Coming", variant: "warning" as const };
  }
  if (entry.checkOutAt) {
    return { label: "Checked Out", variant: "success" as const };
  }
  return { label: "Checked In", variant: "accent" as const };
}

function getActiveBreak(breakSessions: BreakSessionRecord[]) {
  return breakSessions.find((entry) => !entry.endAt) ?? null;
}

function getCurrentAttendanceLocation() {
  return new Promise<AttendanceLocationPayload>((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Location access is not available in this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      () => {
        reject(new Error("Please allow location access to mark attendance."));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      },
    );
  });
}

interface AttendanceTrackerProps {
  initialData: AttendancePayload;
}

export function AttendanceTracker({ initialData }: AttendanceTrackerProps) {
  const [data, setData] = useState(initialData);
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function loadAttendance() {
    try {
      const response = await fetch("/api/attendance", {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "Unable to load attendance.");
      }

      setNow(new Date());
      setData(payload.data as AttendancePayload);
    } catch (error) {
      throw error instanceof Error ? error : new Error("Unable to load attendance.");
    }
  }

  async function refreshAttendance() {
    setLoading(true);
    setNotice(null);
    try {
      await loadAttendance();
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Unable to refresh attendance data.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function runAction(
    actionKey: string,
    path: string,
    method: "POST" | "PATCH",
    successText: string,
    options?: { requiresLocation?: boolean },
  ) {
    setActionLoading(actionKey);
    setNotice(null);

    try {
      const location = options?.requiresLocation ? await getCurrentAttendanceLocation() : null;
      const response = await fetch(path, {
        method,
        headers: location ? { "Content-Type": "application/json" } : undefined,
        body: location ? JSON.stringify(location) : undefined,
      });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Unable to complete this action.");
      }

      await loadAttendance();
      setNotice({ tone: "success", text: successText });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Unable to complete this action.",
      });
    } finally {
      setActionLoading(null);
    }
  }

  function confirmBeforeCheckout() {
    if (typeof window !== "undefined") {
      const shouldContinue = window.confirm(
        "Are you sure you want to check out for today?",
      );
      if (!shouldContinue) {
        return;
      }
    }

    void runAction(
      "check-out",
      "/api/attendance/checkout",
      "PATCH",
      "Check-out marked successfully.",
    );
  }

  const todayEntry = data.todayEntry;
  const monthSummary = data.monthSummary;
  const todayBreakSessions = todayEntry?.breakSessions ?? [];
  const activeBreak = getActiveBreak(todayBreakSessions);
  const liveTodayWorkedMinutes = getLiveWorkedMinutes(todayEntry, todayBreakSessions, now);
  const liveMonthWorkedMinutes = useMemo(() => {
    const storedTodayMinutes = todayEntry?.workedMinutes ?? 0;
    return monthSummary.workedMinutes - storedTodayMinutes + liveTodayWorkedMinutes;
  }, [liveTodayWorkedMinutes, monthSummary.workedMinutes, todayEntry?.workedMinutes]);
  const attendanceStatus = statusFromEntry(todayEntry);
  const [showAllEntries, setShowAllEntries] = useState(false);
  const visibleEntries = showAllEntries
    ? data.recentEntries
    : data.recentEntries.slice(0, VISIBLE_ENTRIES);
  const canCheckIn = !todayEntry;
  const canCheckOut = Boolean(todayEntry?.checkInAt && !todayEntry?.checkOutAt && !activeBreak);
  const canStartBreak = Boolean(todayEntry?.checkInAt && !todayEntry?.checkOutAt && !activeBreak);
  const canEndBreak = Boolean(todayEntry?.checkInAt && !todayEntry?.checkOutAt && activeBreak);

  useEffect(() => {
    if (!todayEntry?.checkInAt || todayEntry.checkOutAt) {
      return;
    }

    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 30000);

    return () => window.clearInterval(timer);
  }, [todayEntry?.checkInAt, todayEntry?.checkOutAt]);

  return (
    <section className="space-y-5">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[19px] font-bold tracking-tight text-vega-text">Monthly Summary</h2>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-[13px] text-vega-text-muted min-[400px]:inline">This Month</span>
            <span className="inline-flex items-center gap-2 rounded-lg border border-vega-border bg-vega-surface-1 px-2.5 py-1.5 text-[12.5px] font-medium text-vega-text-secondary">
              <CalendarDays className="h-4 w-4 shrink-0 text-vega-text-muted" strokeWidth={1.8} />
              {monthLabel()}
            </span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-5 sm:gap-x-7 lg:grid-cols-3 2xl:grid-cols-4">
          <SummaryRow icon={CalendarDays} tone="green" label="Present Days" value={String(monthSummary.presentDays)} />
          <SummaryRow icon={Clock} tone="green" label="Worked Time" value={formatMinutesAsHours(liveMonthWorkedMinutes)} />
          <SummaryRow icon={CircleCheck} tone="blue" label="Completed Days" value={String(monthSummary.completedDays)} />
          <SummaryRow icon={Contrast} tone="amber" label="Half Days" value={String(monthSummary.halfDays)} />
          <SummaryRow icon={AlarmClock} tone="orange" label="Late Coming" value={String(monthSummary.lateComingDays)} />
          <SummaryRow icon={Coffee} tone="pink" label="Break Time" value={formatMinutesAsHours(monthSummary.breakMinutes)} />
          <SummaryRow icon={CalendarX} tone="pink" label="Absent Days" value={String(monthSummary.absentDays)} />
        </div>
      </div>

      <div className="border-t border-vega-border-soft pt-5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-vega-accent-border bg-vega-accent-soft text-[#93c5fd]">
              <CalendarDays className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </span>
            <h2 className="truncate text-[19px] font-bold tracking-tight text-vega-text">
              Today&apos;s Attendance
            </h2>
          </div>
          <span className="text-[13px] text-vega-text-muted">
            {formatFullDate(todayEntry?.dateKey)}
          </span>
        </div>

        <p className="mt-2.5 text-[13.5px] text-vega-text-muted">
          Mark check-in and check-out once per day.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Badge variant={attendanceStatus.variant}>{attendanceStatus.label}</Badge>
          <span className="text-[13px] text-vega-text-muted">Admin is excluded from this flow.</span>
        </div>

        {/* One panel split by rules rather than four separate boxes, so the four
            figures read as one row of today's state. */}
        <div className="mt-4 grid grid-cols-4 divide-x divide-vega-border-soft overflow-hidden rounded-xl border border-vega-border">
          <TodayFigure icon={LogIn} tone="green" label="Check-In" value={formatTime(todayEntry?.checkInAt)} />
          <TodayFigure icon={LogOut} tone="pink" label="Check-Out" value={formatTime(todayEntry?.checkOutAt)} />
          <TodayFigure icon={Clock} tone="blue" label="Worked Time" value={formatMinutesAsHours(liveTodayWorkedMinutes)} />
          <TodayFigure icon={Coffee} tone="violet" label="Break Time" value={formatMinutesAsHours(todayEntry?.totalBreakMinutes ?? 0)} />
        </div>

        <div className="mt-3.5 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
          <ActionButton
            icon={Play}
            primary
            label={actionLoading === "check-in" ? "Checking In..." : "Check In"}
            onClick={() =>
              runAction("check-in", "/api/attendance", "POST", "Check-in marked successfully.", {
                requiresLocation: true,
              })
            }
            disabled={loading || actionLoading !== null || !canCheckIn}
          />
          <ActionButton
            icon={LogOut}
            label={actionLoading === "check-out" ? "Checking Out..." : "Check Out"}
            onClick={confirmBeforeCheckout}
            disabled={loading || actionLoading !== null || !canCheckOut}
          />
          <ActionButton
            icon={Coffee}
            label={actionLoading === "break-start" ? "Starting Break..." : "Start Break"}
            onClick={() => runAction("break-start", "/api/attendance/break/start", "PATCH", "Break started.")}
            disabled={loading || actionLoading !== null || !canStartBreak}
          />
          <ActionButton
            icon={Square}
            label={actionLoading === "break-end" ? "Ending Break..." : "End Break"}
            onClick={() => runAction("break-end", "/api/attendance/break/end", "PATCH", "Break ended.")}
            disabled={loading || actionLoading !== null || !canEndBreak}
          />
          <div className="col-span-2 sm:contents">
            <ActionButton
              icon={RefreshCw}
              label={loading ? "Refreshing..." : "Refresh"}
              onClick={() => void refreshAttendance()}
              disabled={loading || actionLoading !== null}
            />
          </div>
        </div>

        {activeBreak ? (
          <p className="mt-3 rounded-lg border border-vega-yellow/35 bg-vega-yellow/10 px-3 py-2.5 text-[13px] text-vega-yellow">
            Break in progress since {formatTime(activeBreak.startAt)}.
          </p>
        ) : null}

        {notice ? (
          <p
            role="alert"
            className={
              notice.tone === "error"
                ? "mt-3 rounded-lg border border-vega-red/35 bg-vega-red/10 px-3 py-2.5 text-[13px] text-vega-red"
                : "mt-3 rounded-lg border border-vega-green/35 bg-vega-green/10 px-3 py-2.5 text-[13px] text-[#66dc91]"
            }
          >
            {notice.text}
          </p>
        ) : null}

        {todayBreakSessions.length > 0 ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-vega-border">
            {todayBreakSessions.map((session, index) => (
              <div
                key={`${session.startAt ?? "start"}-${index}`}
                className="flex items-center justify-between gap-3 border-b border-vega-border-soft px-3 py-2.5 text-[13px] last:border-b-0"
              >
                <span className="text-vega-text">{formatTime(session.startAt)}</span>
                <span className="text-vega-text-muted">
                  {session.endAt ? formatTime(session.endAt) : "In Progress"}
                </span>
                <span className="text-vega-text-muted">{formatMinutesAsHours(session.minutes ?? 0)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="border-t border-vega-border-soft pt-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-vega-accent-border bg-vega-accent-soft text-[#93c5fd]">
              <FileText className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </span>
            <h2 className="truncate text-[19px] font-bold tracking-tight text-vega-text">
              Recent Attendance
            </h2>
          </div>
          {data.recentEntries.length > VISIBLE_ENTRIES ? (
            <button
              type="button"
              onClick={() => setShowAllEntries((shown) => !shown)}
              className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-vega-text-secondary transition-colors hover:text-vega-text"
            >
              {showAllEntries ? "Show less" : "View all"}
              <ChevronRight
                className={cn("h-4 w-4 transition-transform", showAllEntries && "rotate-90")}
                strokeWidth={1.8}
              />
            </button>
          ) : null}
        </div>

        {data.recentEntries.length === 0 ? (
          <p className="mt-4 text-[13px] text-vega-text-muted">No attendance records yet.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-vega-border">
            {visibleEntries.map((entry) => {
              const status = statusFromEntry(entry);
              const worked =
                entry._id === todayEntry?._id ? liveTodayWorkedMinutes : entry.workedMinutes ?? 0;

              return (
                <div
                  key={entry._id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-vega-border-soft px-3.5 py-3.5 last:border-b-0"
                >
                  <div className="w-[72px] shrink-0">
                    <p className="text-[19px] font-bold leading-none text-vega-text">
                      {dayOfMonth(entry.dateKey)}
                    </p>
                    <p className="mt-1 text-[12px] leading-none text-vega-text-muted">
                      {monthAndYear(entry.dateKey)}
                    </p>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-wrap gap-x-5 gap-y-2.5">
                    <EntryFigure label="Check-in" value={formatTime(entry.checkInAt)} />
                    <EntryFigure label="Check-out" value={formatTime(entry.checkOutAt)} />
                    <EntryFigure label="Worked Time" value={formatMinutesAsHours(worked)} />
                  </div>

                  <Badge variant={status.variant} className="shrink-0 whitespace-nowrap">
                    {status.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

const TONE_TEXT = {
  blue: "text-[#6da2ff]",
  green: "text-[#5fd88c]",
  violet: "text-[#a98bff]",
  amber: "text-[#e6bb3f]",
  pink: "text-[#f07cb5]",
  orange: "text-[#f59e5c]",
} as const;

type Tone = keyof typeof TONE_TEXT;
type IconType = ComponentType<{ className?: string; strokeWidth?: number }>;

/** One month figure: icon, label, and the number pushed to the right. */
function SummaryRow({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: IconType;
  tone: Tone;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-vega-border-soft py-3">
      <Icon className={cn("h-[19px] w-[19px] shrink-0", TONE_TEXT[tone])} strokeWidth={1.9} />
      <span className="min-w-0 flex-1 truncate text-[14px] text-vega-text-secondary">{label}</span>
      <span className="shrink-0 text-[15px] font-bold text-vega-text">{value}</span>
    </div>
  );
}

/** One cell of today's four-up panel. */
function TodayFigure({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: IconType;
  tone: Tone;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 px-1.5 py-3 sm:px-3.5">
      <span className="flex items-center gap-1.5">
        <Icon className={cn("h-[15px] w-[15px] shrink-0", TONE_TEXT[tone])} strokeWidth={1.9} />
        <span className="truncate text-[11px] text-vega-text-muted sm:text-[12.5px]">{label}</span>
      </span>
      <p className="mt-1.5 truncate text-[13.5px] font-bold text-vega-text sm:text-[15px]">{value}</p>
    </div>
  );
}

/** A label/value pair inside a recent-attendance row. */
function EntryFigure({ label, value }: { label: string; value: string }) {
  return (
    <span className="min-w-0">
      <span className="block text-[12px] leading-none text-vega-text-muted">{label}</span>
      <span className="mt-1.5 block whitespace-nowrap text-[13.5px] font-medium text-vega-text">
        {value}
      </span>
    </span>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  primary = false,
}: {
  icon: IconType;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-[50px] w-full items-center justify-center gap-2.5 rounded-xl text-[14.5px] font-semibold transition-colors",
        "sm:h-[42px] sm:w-auto sm:px-5 sm:text-[13.5px]",
        primary
          ? "bg-vega-accent text-white hover:bg-vega-accent-hover"
          : "border border-vega-border bg-vega-surface-1 text-vega-text-secondary hover:bg-vega-surface-hover hover:text-vega-text",
        "disabled:cursor-not-allowed disabled:opacity-45",
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} />
      <span className="truncate">{label}</span>
    </button>
  );
}
