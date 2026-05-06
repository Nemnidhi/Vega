"use client";

import { useState } from "react";
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
  if (entry.checkOutAt) {
    return { label: "Checked Out", variant: "success" as const };
  }
  return { label: "Checked In", variant: "accent" as const };
}

function getActiveBreak(breakSessions: BreakSessionRecord[]) {
  return breakSessions.find((entry) => !entry.endAt) ?? null;
}

interface AttendanceTrackerProps {
  initialData: AttendancePayload;
}

export function AttendanceTracker({ initialData }: AttendanceTrackerProps) {
  const [data, setData] = useState(initialData);
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
  ) {
    setActionLoading(actionKey);
    setNotice(null);

    try {
      const response = await fetch(path, { method });
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
  const attendanceStatus = statusFromEntry(todayEntry);
  const canCheckIn = !todayEntry;
  const canCheckOut = Boolean(todayEntry?.checkInAt && !todayEntry?.checkOutAt && !activeBreak);
  const canStartBreak = Boolean(todayEntry?.checkInAt && !todayEntry?.checkOutAt && !activeBreak);
  const canEndBreak = Boolean(todayEntry?.checkInAt && !todayEntry?.checkOutAt && activeBreak);

  return (
    <section className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
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
              {formatMinutesAsHours(monthSummary.workedMinutes)}
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
            <div className="rounded-lg border border-border bg-white p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Check-in</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {formatTime(todayEntry?.checkInAt)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-white p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Check-out</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {formatTime(todayEntry?.checkOutAt)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-white p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Worked Time</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {formatMinutesAsHours(todayEntry?.workedMinutes ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-white p-3">
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
                          {formatMinutesAsHours(entry.workedMinutes ?? 0)}
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
