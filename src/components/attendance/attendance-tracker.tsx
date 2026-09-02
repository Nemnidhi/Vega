"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

function formatDateFromKey(dateKey?: string) {
  if (!dateKey) {
    return "--";
  }
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
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
    return { label: "Late Coming", variant: "accent" as const };
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
    <section className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-7">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Present Days (Month)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">{monthSummary.presentDays}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Worked Time (Month)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">
              {formatMinutesAsHours(liveMonthWorkedMinutes)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Completed Days (Month)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">{monthSummary.completedDays}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Half Days (Month)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">{monthSummary.halfDays}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Late Coming (Month)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">{monthSummary.lateComingDays}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Absent Days (Month)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">{monthSummary.absentDays}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Break Time (Month)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">
              {formatMinutesAsHours(monthSummary.breakMinutes)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Attendance</CardTitle>
          <CardDescription>
            Mark check-in and check-out once per day. Admin is excluded from this flow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={attendanceStatus.variant}>{attendanceStatus.label}</Badge>
            <p className="text-sm text-muted-foreground">
              Date: <span className="font-medium text-foreground">{formatDateFromKey(todayEntry?.dateKey)}</span>
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-vega-surface-1 p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Check-in</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {formatTime(todayEntry?.checkInAt)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-vega-surface-1 p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Check-out</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {formatTime(todayEntry?.checkOutAt)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-vega-surface-1 p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Worked Time</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {formatMinutesAsHours(liveTodayWorkedMinutes)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-vega-surface-1 p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Break Time</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {formatMinutesAsHours(todayEntry?.totalBreakMinutes ?? 0)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() =>
                runAction(
                  "check-in",
                  "/api/attendance",
                  "POST",
                  "Check-in marked successfully.",
                  { requiresLocation: true },
                )
              }
              disabled={loading || actionLoading !== null || !canCheckIn}
            >
              {actionLoading === "check-in" ? "Checking In..." : "Check In"}
            </Button>
            <Button
              variant="secondary"
              onClick={confirmBeforeCheckout}
              disabled={loading || actionLoading !== null || !canCheckOut}
            >
              {actionLoading === "check-out" ? "Checking Out..." : "Check Out"}
            </Button>
            <Button
              variant="subtle"
              onClick={() =>
                runAction("break-start", "/api/attendance/break/start", "PATCH", "Break started.")
              }
              disabled={loading || actionLoading !== null || !canStartBreak}
            >
              {actionLoading === "break-start" ? "Starting Break..." : "Start Break"}
            </Button>
            <Button
              variant="subtle"
              onClick={() =>
                runAction("break-end", "/api/attendance/break/end", "PATCH", "Break ended.")
              }
              disabled={loading || actionLoading !== null || !canEndBreak}
            >
              {actionLoading === "break-end" ? "Ending Break..." : "End Break"}
            </Button>
            <Button
              variant="subtle"
              onClick={() => void refreshAttendance()}
              disabled={loading || actionLoading !== null}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          {activeBreak ? (
            <div className="rounded-lg border border-warning/30 bg-[#f8f1e4] p-3 text-sm text-warning">
              Break in progress since {formatTime(activeBreak.startAt)}.
            </div>
          ) : null}

          {notice ? (
            <p className={notice.tone === "error" ? "text-sm text-danger" : "text-sm text-success"}>
              {notice.text}
            </p>
          ) : null}

          {todayBreakSessions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-2 py-2">Break Start</th>
                    <th className="px-2 py-2">Break End</th>
                    <th className="px-2 py-2">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {todayBreakSessions.map((session, index) => (
                    <tr key={`${session.startAt ?? "start"}-${index}`} className="border-b border-border/60">
                      <td className="px-2 py-2 text-foreground">{formatTime(session.startAt)}</td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {session.endAt ? formatTime(session.endAt) : "In Progress"}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {formatMinutesAsHours(session.minutes ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Attendance</CardTitle>
          <CardDescription>Last 21 entries from your attendance log.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attendance records yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-2 py-2">Date</th>
                    <th className="px-2 py-2">Check-in</th>
                    <th className="px-2 py-2">Check-out</th>
                    <th className="px-2 py-2">Worked Time</th>
                    <th className="px-2 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentEntries.map((entry) => {
                    const status = statusFromEntry(entry);
                    return (
                      <tr key={entry._id} className="border-b border-border/60">
                        <td className="px-2 py-2 text-foreground">
                          {formatDateFromKey(entry.dateKey)}
                        </td>
                        <td className="px-2 py-2 text-muted-foreground">
                          {formatTime(entry.checkInAt)}
                        </td>
                        <td className="px-2 py-2 text-muted-foreground">
                          {formatTime(entry.checkOutAt)}
                        </td>
                        <td className="px-2 py-2 text-muted-foreground">
                          {formatMinutesAsHours(
                            entry._id === todayEntry?._id
                              ? liveTodayWorkedMinutes
                              : entry.workedMinutes ?? 0,
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
