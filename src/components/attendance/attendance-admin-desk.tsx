"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  AdminDailyAttendanceRecord,
  AdminMonthlyAttendancePayload,
  AttendanceDayStatus,
  AttendanceStaffUser,
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

type AttendanceMarkStatus = "present" | "absent" | "half_day";

interface AttendanceAdminDeskProps {
  initialDailyDateKey: string;
  initialDailyRecords: AdminDailyAttendanceRecord[];
  initialMonthKey: string;
  initialMonthlyData: AdminMonthlyAttendancePayload;
  staffUsers: AttendanceStaffUser[];
}

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

function formatMonthFromKey(monthKey?: string) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
    return "--";
  }
  return new Date(`${monthKey}-01T00:00:00`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
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

function statusBadge(status: string) {
  if (status === "present") {
    return { label: status, variant: "success" as const };
  }
  if (status === "absent") {
    return { label: status, variant: "danger" as const };
  }
  if (status === "half_day") {
    return { label: "half day", variant: "warning" as const };
  }
  return { label: status, variant: "accent" as const };
}

function getStatusSymbol(status?: AttendanceDayStatus) {
  if (status === "present") return "P";
  if (status === "absent") return "A";
  if (status === "half_day") return "H";
  return "-";
}

function getStatusSymbolClass(status?: AttendanceDayStatus) {
  if (status === "present") {
    return "bg-success/15 text-success";
  }
  if (status === "absent") {
    return "bg-danger/15 text-danger";
  }
  if (status === "half_day") {
    return "bg-warning/15 text-warning";
  }
  return "bg-muted text-muted-foreground";
}

function buildMonthDateKeys(monthKey: string) {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return [] as string[];
  }

  const [yearPart, monthPart] = monthKey.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return [] as string[];
  }

  const daysInMonth = new Date(year, month, 0).getDate();

  return Array.from({ length: daysInMonth }, (_, dayIndex) => {
    const day = String(dayIndex + 1).padStart(2, "0");
    return `${monthKey}-${day}`;
  });
}

export function AttendanceAdminDesk({
  initialDailyDateKey,
  initialDailyRecords,
  initialMonthKey,
  initialMonthlyData,
  staffUsers,
}: AttendanceAdminDeskProps) {
  const [dailyDateKey, setDailyDateKey] = useState(initialDailyDateKey);
  const [dailyRecords, setDailyRecords] = useState(initialDailyRecords);
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [monthlyData, setMonthlyData] = useState(initialMonthlyData);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [markForm, setMarkForm] = useState({
    userId: staffUsers[0]?._id ?? "",
    dateKey: initialDailyDateKey,
    dayStatus: "present" as AttendanceMarkStatus,
  });

  async function loadDailyRecords(dateKey: string) {
    const response = await fetch(`/api/attendance/admin/daily?dateKey=${dateKey}`, {
      method: "GET",
      cache: "no-store",
    });
    const payload = (await response.json()) as ApiResponse;
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error?.message ?? "Unable to load daily attendance.");
    }

    const parsed = payload.data as {
      dateKey: string;
      records: AdminDailyAttendanceRecord[];
    };
    setDailyDateKey(parsed.dateKey);
    setDailyRecords(parsed.records);
  }

  async function loadMonthlyRecords(nextMonthKey: string) {
    const response = await fetch(`/api/attendance/admin/month?month=${nextMonthKey}`, {
      method: "GET",
      cache: "no-store",
    });
    const payload = (await response.json()) as ApiResponse;
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error?.message ?? "Unable to load monthly attendance.");
    }

    const parsed = payload.data as AdminMonthlyAttendancePayload;
    setMonthKey(parsed.monthKey);
    setMonthlyData(parsed);
  }

  async function runAction(
    key: string,
    path: string,
    method: "PATCH" | "POST",
    successText: string,
    options?: {
      body?: Record<string, unknown>;
      refreshDaily?: boolean;
      refreshDateKey?: string;
      refreshMonthly?: boolean;
      refreshMonthKey?: string;
      onSuccess?: () => void;
    },
  ) {
    setLoadingKey(key);
    setNotice(null);

    try {
      const response = await fetch(path, {
        method,
        headers: options?.body ? { "Content-Type": "application/json" } : undefined,
        body: options?.body ? JSON.stringify(options.body) : undefined,
      });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Unable to complete action.");
      }

      if (options?.refreshDaily) {
        await loadDailyRecords(options.refreshDateKey ?? dailyDateKey);
      }
      if (options?.refreshMonthly) {
        await loadMonthlyRecords(options.refreshMonthKey ?? monthKey);
      }

      options?.onSuccess?.();
      setNotice({ tone: "success", text: successText });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Unable to complete action.",
      });
    } finally {
      setLoadingKey(null);
    }
  }

  async function refreshDailyForSelectedDate() {
    setLoadingKey("daily-refresh");
    setNotice(null);
    try {
      await loadDailyRecords(dailyDateKey);
      setNotice({ tone: "success", text: "Daily records refreshed." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Unable to load daily attendance.",
      });
    } finally {
      setLoadingKey(null);
    }
  }

  async function refreshMonthlyForSelectedMonth() {
    setLoadingKey("month-refresh");
    setNotice(null);
    try {
      await loadMonthlyRecords(monthKey);
      setNotice({ tone: "success", text: "Monthly records refreshed." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Unable to load monthly attendance.",
      });
    } finally {
      setLoadingKey(null);
    }
  }

  const monthDateKeys = useMemo(() => buildMonthDateKeys(monthlyData.monthKey), [monthlyData.monthKey]);

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Mark Attendance</CardTitle>
          <CardDescription>Admin can mark or update attendance manually for any date.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <select
              className="h-11 w-full rounded-lg border border-border bg-white px-3.5 text-sm text-foreground"
              value={markForm.userId}
              onChange={(event) =>
                setMarkForm((prev) => ({ ...prev, userId: event.target.value }))
              }
            >
              {staffUsers.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.fullName} ({user.role})
                </option>
              ))}
            </select>
            <Input
              type="date"
              value={markForm.dateKey}
              onChange={(event) =>
                setMarkForm((prev) => ({ ...prev, dateKey: event.target.value }))
              }
            />
            <select
              className="h-11 w-full rounded-lg border border-border bg-white px-3.5 text-sm text-foreground"
              value={markForm.dayStatus}
              onChange={(event) =>
                setMarkForm((prev) => ({
                  ...prev,
                  dayStatus: event.target.value as AttendanceMarkStatus,
                }))
              }
            >
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="half_day">Half Day</option>
            </select>
            <Button
              onClick={() =>
                runAction(
                  "attendance-mark",
                  "/api/attendance/admin/mark",
                  "POST",
                  "Attendance marked successfully.",
                  {
                    body: markForm,
                    refreshDaily: true,
                    refreshDateKey: markForm.dateKey,
                    refreshMonthly: true,
                    refreshMonthKey: markForm.dateKey.slice(0, 7),
                  },
                )
              }
              disabled={!markForm.userId || !markForm.dateKey || loadingKey !== null}
            >
              {loadingKey === "attendance-mark" ? "Saving..." : "Mark Attendance"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daily Attendance View</CardTitle>
          <CardDescription>
            Review all marked records for {formatDateFromKey(dailyDateKey)}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="date"
              value={dailyDateKey}
              onChange={(event) => setDailyDateKey(event.target.value)}
              className="max-w-[220px]"
            />
            <Button
              variant="secondary"
              onClick={() => void refreshDailyForSelectedDate()}
              disabled={!dailyDateKey || loadingKey !== null}
            >
              {loadingKey === "daily-refresh" ? "Refreshing..." : "Load Date"}
            </Button>
          </div>

          {dailyRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground">No records found for this date.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-2 py-2">Staff</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Check-in</th>
                    <th className="px-2 py-2">Check-out</th>
                    <th className="px-2 py-2">Worked</th>
                    <th className="px-2 py-2">Break</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyRecords.map((record) => {
                    const badge = statusBadge(record.dayStatus);
                    const staffLabel = record.userId
                      ? `${record.userId.fullName} (${record.userId.email})`
                      : "Unknown";
                    return (
                      <tr key={record._id} className="border-b border-border/60">
                        <td className="px-2 py-2 text-foreground">{staffLabel}</td>
                        <td className="px-2 py-2">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </td>
                        <td className="px-2 py-2 text-muted-foreground">
                          {formatTime(record.checkInAt)}
                        </td>
                        <td className="px-2 py-2 text-muted-foreground">
                          {formatTime(record.checkOutAt)}
                        </td>
                        <td className="px-2 py-2 text-muted-foreground">
                          {formatMinutesAsHours(record.workedMinutes ?? 0)}
                        </td>
                        <td className="px-2 py-2 text-muted-foreground">
                          {formatMinutesAsHours(record.totalBreakMinutes ?? 0)}
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

      <Card>
        <CardHeader>
          <CardTitle>Monthly Team Attendance</CardTitle>
          <CardDescription>
            View all staff attendance at one place for {formatMonthFromKey(monthlyData.monthKey)}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="month"
              value={monthKey}
              onChange={(event) => setMonthKey(event.target.value)}
              className="max-w-[220px]"
            />
            <Button
              variant="secondary"
              onClick={() => void refreshMonthlyForSelectedMonth()}
              disabled={!monthKey || loadingKey !== null}
            >
              {loadingKey === "month-refresh" ? "Refreshing..." : "Load Month"}
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-lg border border-border/70 bg-card px-3 py-2">
              <p className="text-xs text-muted-foreground">Total Staff</p>
              <p className="text-lg font-semibold text-foreground">{monthlyData.totals.staffCount}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-card px-3 py-2">
              <p className="text-xs text-muted-foreground">Marked Days</p>
              <p className="text-lg font-semibold text-foreground">
                {monthlyData.totals.totalMarkedDays}
              </p>
            </div>
            <div className="rounded-lg border border-border/70 bg-card px-3 py-2">
              <p className="text-xs text-muted-foreground">Present / Absent / Half</p>
              <p className="text-lg font-semibold text-foreground">
                {monthlyData.totals.presentDays} / {monthlyData.totals.absentDays} /{" "}
                {monthlyData.totals.halfDays}
              </p>
            </div>
          </div>

          {monthlyData.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No attendance marked for this month yet.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded bg-success/15 px-2 py-1 text-success">
                  <span className="font-semibold">P</span> Present
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-danger/15 px-2 py-1 text-danger">
                  <span className="font-semibold">A</span> Absent
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-warning/15 px-2 py-1 text-warning">
                  <span className="font-semibold">H</span> Half Day
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-muted-foreground">
                  <span className="font-semibold">-</span> Not Marked
                </span>
              </div>

              {monthlyData.rows.map((row) => {
                const recordByDateKey = new Map(
                  row.records.map((record) => [record.dateKey, record.dayStatus] as const),
                );

                return (
                  <div
                    key={row.user._id}
                    className="space-y-3 rounded-lg border border-border/70 bg-card px-3 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{row.user.fullName}</p>
                        <p className="break-all text-[11px] text-muted-foreground">
                          {row.user.role} | {row.user.email}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-[11px]">
                        <span className="rounded bg-success/15 px-2 py-1 font-semibold text-success">
                          P {row.summary.presentDays}
                        </span>
                        <span className="rounded bg-danger/15 px-2 py-1 font-semibold text-danger">
                          A {row.summary.absentDays}
                        </span>
                        <span className="rounded bg-warning/15 px-2 py-1 font-semibold text-warning">
                          H {row.summary.halfDays}
                        </span>
                        <span className="rounded bg-muted px-2 py-1 font-semibold text-foreground">
                          T {row.summary.totalMarkedDays}
                        </span>
                      </div>
                    </div>

                    <div
                      className="grid gap-1.5"
                      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(38px, 1fr))" }}
                    >
                      {monthDateKeys.map((dateKey) => {
                        const dayStatus = recordByDateKey.get(dateKey);
                        return (
                          <div
                            key={`${row.user._id}-${dateKey}`}
                            className={`rounded border border-border/50 px-1 py-1 text-center ${getStatusSymbolClass(dayStatus)}`}
                            title={`${dateKey}: ${dayStatus ?? "not_marked"}`}
                          >
                            <p className="text-[10px] leading-none opacity-80">{dateKey.slice(-2)}</p>
                            <p className="text-xs font-semibold leading-tight">
                              {getStatusSymbol(dayStatus)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {notice ? (
        <p className={notice.tone === "error" ? "text-sm text-danger" : "text-sm text-success"}>
          {notice.text}
        </p>
      ) : null}
    </section>
  );
}
