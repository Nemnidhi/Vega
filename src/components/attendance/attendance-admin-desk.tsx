"use client";

import { useState } from "react";
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

export function AttendanceAdminDesk({
  initialDailyDateKey,
  initialDailyRecords,
  staffUsers,
}: AttendanceAdminDeskProps) {
  const [dailyDateKey, setDailyDateKey] = useState(initialDailyDateKey);
  const [dailyRecords, setDailyRecords] = useState(initialDailyRecords);
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

  async function runAction(
    key: string,
    path: string,
    method: "PATCH" | "POST",
    successText: string,
    options?: {
      body?: Record<string, unknown>;
      refreshDaily?: boolean;
      refreshDateKey?: string;
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

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Mark Attendance</CardTitle>
          <CardDescription>Set present, absent, or half day for selected staff.</CardDescription>
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

      {notice ? (
        <p className={notice.tone === "error" ? "text-sm text-danger" : "text-sm text-success"}>
          {notice.text}
        </p>
      ) : null}
    </section>
  );
}
