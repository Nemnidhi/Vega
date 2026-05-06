"use client";

import { useCallback, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";
import type {
  AttendanceCalendarDayRecord,
  AttendanceCalendarMonthPayload,
  AttendanceDayStatus,
} from "@/lib/attendance/queries";
import type { IndiaHoliday } from "@/lib/calendar/india-holidays-2026";

type LeaveType = "casual" | "sick" | "planned" | "unpaid" | "other";

type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

type LeaveRequestView = {
  _id: string;
  leaveType: LeaveType;
  startDateKey: string;
  endDateKey: string;
  totalDays: number;
  reason?: string;
  status: LeaveStatus;
};

type LeaveBalanceView = {
  availableDays: number;
  pendingRequestedDays: number;
  monthlyAccrualDays: number;
};

type LeavePanelData = {
  requests: LeaveRequestView[];
  balance: LeaveBalanceView;
};

type HolidayViewProps = {
  holidays: IndiaHoliday[];
  initialLeaveData?: LeavePanelData | null;
  initialAttendanceData?: AttendanceCalendarMonthPayload | null;
};

type HolidayWithDate = IndiaHoliday & {
  date: Date;
};

type LeaveDateEntry = {
  requestId: string;
  leaveType: LeaveType;
  status: LeaveStatus;
};

type DayCell = {
  date: Date;
  dateKey: string;
  inCurrentMonth: boolean;
  isToday: boolean;
  holidays: HolidayWithDate[];
  leaveEntries: LeaveDateEntry[];
  attendanceStatus: AttendanceDayStatus | null;
};

type DateRangeSelection = {
  startDateKey: string | null;
  endDateKey: string | null;
};

type ApiResponse = {
  success: boolean;
  data?: unknown;
  error?: {
    message?: string;
  };
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const leaveTypeOptions: Array<{ value: LeaveType; label: string }> = [
  { value: "casual", label: "Casual" },
  { value: "sick", label: "Sick" },
  { value: "planned", label: "Planned" },
  { value: "unpaid", label: "Unpaid" },
  { value: "other", label: "Other" },
];

const monthTitleFormatter = new Intl.DateTimeFormat("en-IN", {
  month: "long",
  year: "numeric",
});

const fullDateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const weekdayFormatter = new Intl.DateTimeFormat("en-IN", {
  weekday: "long",
});

function parseDateKey(dateKey: string) {
  const parts = dateKey.split("-");
  const year = Number(parts[0] ?? 0);
  const month = Number(parts[1] ?? 1);
  const day = Number(parts[2] ?? 1);
  return new Date(year, month - 1, day);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function isSameMonth(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function getLeaveStatusOrder(status: LeaveStatus) {
  if (status === "approved") return 0;
  if (status === "pending") return 1;
  if (status === "rejected") return 2;
  return 3;
}

function getLeaveStatusBadge(status: LeaveStatus) {
  if (status === "approved") {
    return { label: "Approved", variant: "success" as const };
  }
  if (status === "pending") {
    return { label: "Pending", variant: "warning" as const };
  }
  if (status === "rejected") {
    return { label: "Rejected", variant: "danger" as const };
  }
  return { label: "Cancelled", variant: "neutral" as const };
}

function getLeaveStatusPillClass(status: LeaveStatus) {
  if (status === "approved") {
    return "border border-[#b8d7c3] bg-[#edf7f0] text-[#2f6a42]";
  }
  if (status === "pending") {
    return "border border-[#dec39d] bg-[#f8f1e4] text-[#8a5a1f]";
  }
  if (status === "rejected") {
    return "border border-[#e2b3ae] bg-[#faecea] text-[#a43c35]";
  }
  return "border border-border bg-white text-muted-foreground";
}

function getAttendanceStatusBadge(status: AttendanceDayStatus) {
  if (status === "present") {
    return { label: "Present", shortLabel: "P", variant: "success" as const };
  }
  if (status === "absent") {
    return { label: "Absent", shortLabel: "A", variant: "danger" as const };
  }
  return { label: "Half Day", shortLabel: "H", variant: "warning" as const };
}

function getAttendanceStatusPillClass(status: AttendanceDayStatus) {
  if (status === "present") {
    return "border border-[#b8d7c3] bg-[#edf7f0] text-[#2f6a42]";
  }
  if (status === "absent") {
    return "border border-[#e2b3ae] bg-[#faecea] text-[#a43c35]";
  }
  return "border border-[#dec39d] bg-[#f8f1e4] text-[#8a5a1f]";
}

function expandLeaveDateKeys(startDateKey: string, endDateKey: string) {
  const keys: string[] = [];
  const start = parseDateKey(startDateKey);
  const end = parseDateKey(endDateKey);
  const cursor = new Date(start);
  let guard = 0;

  while (cursor <= end && guard < 400) {
    keys.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }

  return keys;
}

function getOrderedDateRange(startDateKey: string, endDateKey: string) {
  if (startDateKey <= endDateKey) {
    return { startDateKey, endDateKey };
  }

  return {
    startDateKey: endDateKey,
    endDateKey: startDateKey,
  };
}

function isDateWithinRange(dateKey: string, startDateKey: string, endDateKey: string) {
  return dateKey >= startDateKey && dateKey <= endDateKey;
}

function toMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function buildMonthGrid(
  visibleMonth: Date,
  holidaysByDateKey: Map<string, HolidayWithDate[]>,
  leaveByDateKey: Map<string, LeaveDateEntry[]>,
  attendanceByDateKey: Map<string, AttendanceCalendarDayRecord>,
) {
  const currentMonthStart = startOfMonth(visibleMonth);
  const gridStart = new Date(currentMonthStart);
  gridStart.setDate(1 - currentMonthStart.getDay());
  const todayKey = toDateKey(new Date());
  const cells: DayCell[] = [];

  for (let offset = 0; offset < 42; offset += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + offset);
    const dateKey = toDateKey(date);
    const dayHolidays = holidaysByDateKey.get(dateKey) ?? [];
    const leaveEntries = leaveByDateKey.get(dateKey) ?? [];
    const attendanceStatus = attendanceByDateKey.get(dateKey)?.dayStatus ?? null;

    cells.push({
      date,
      dateKey,
      inCurrentMonth: isSameMonth(date, currentMonthStart),
      isToday: dateKey === todayKey,
      holidays: dayHolidays,
      leaveEntries,
      attendanceStatus,
    });
  }

  return cells;
}

export function HolidayCalendarView({
  holidays,
  initialLeaveData = null,
  initialAttendanceData = null,
}: HolidayViewProps) {
  const holidayViews = useMemo<HolidayWithDate[]>(
    () =>
      holidays
        .map((holiday) => ({
          ...holiday,
          date: parseDateKey(holiday.dateKey),
        }))
        .sort((left, right) => left.date.getTime() - right.date.getTime()),
    [holidays],
  );

  const holidaysByDateKey = useMemo(() => {
    const map = new Map<string, HolidayWithDate[]>();

    for (const holiday of holidayViews) {
      const entries = map.get(holiday.dateKey) ?? [];
      entries.push(holiday);
      map.set(holiday.dateKey, entries);
    }

    return map;
  }, [holidayViews]);

  const firstHolidayDate = holidayViews[0]?.date ?? new Date();
  const today = new Date();
  const initialMonth = today.getFullYear() === firstHolidayDate.getFullYear() ? today : firstHolidayDate;
  const initialDateKey = holidayViews[0]?.dateKey ?? toDateKey(today);

  const supportsLeaveApply = initialLeaveData !== null;
  const supportsAttendance = initialAttendanceData !== null;
  const [leaveData, setLeaveData] = useState<LeavePanelData | null>(initialLeaveData);
  const [attendanceMonthData, setAttendanceMonthData] = useState<AttendanceCalendarMonthPayload | null>(
    initialAttendanceData,
  );
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceNotice, setAttendanceNotice] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveActionLoading, setLeaveActionLoading] = useState<string | null>(null);
  const [leaveNotice, setLeaveNotice] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [leaveForm, setLeaveForm] = useState<{
    leaveType: LeaveType;
    startDateKey: string;
    endDateKey: string;
    reason: string;
  }>({
    leaveType: "casual",
    startDateKey: initialDateKey,
    endDateKey: initialDateKey,
    reason: "",
  });

  const [visibleMonth, setVisibleMonth] = useState<Date>(startOfMonth(initialMonth));
  const [selectedDateKey, setSelectedDateKey] = useState<string>(initialDateKey);
  const [rangeSelection, setRangeSelection] = useState<DateRangeSelection>({
    startDateKey: initialDateKey,
    endDateKey: initialDateKey,
  });

  const leaveByDateKey = useMemo(() => {
    const map = new Map<string, LeaveDateEntry[]>();
    const requests = leaveData?.requests ?? [];

    for (const request of requests) {
      const dayKeys = expandLeaveDateKeys(request.startDateKey, request.endDateKey);
      for (const dayKey of dayKeys) {
        const entries = map.get(dayKey) ?? [];
        entries.push({
          requestId: request._id,
          leaveType: request.leaveType,
          status: request.status,
        });
        entries.sort((left, right) => getLeaveStatusOrder(left.status) - getLeaveStatusOrder(right.status));
        map.set(dayKey, entries);
      }
    }

    return map;
  }, [leaveData]);

  const attendanceByDateKey = useMemo(() => {
    const map = new Map<string, AttendanceCalendarDayRecord>();
    for (const record of attendanceMonthData?.records ?? []) {
      map.set(record.dateKey, record);
    }
    return map;
  }, [attendanceMonthData]);

  const monthCells = useMemo(
    () => buildMonthGrid(visibleMonth, holidaysByDateKey, leaveByDateKey, attendanceByDateKey),
    [visibleMonth, holidaysByDateKey, leaveByDateKey, attendanceByDateKey],
  );

  const selectedDate = useMemo(() => parseDateKey(selectedDateKey), [selectedDateKey]);
  const selectedDayHolidays = holidaysByDateKey.get(selectedDateKey) ?? [];
  const selectedDayLeaveEntries = useMemo(
    () => leaveByDateKey.get(selectedDateKey) ?? [],
    [leaveByDateKey, selectedDateKey],
  );

  const selectedDayLeaveRequests = useMemo(() => {
    if (!leaveData) {
      return [] as LeaveRequestView[];
    }
    const requestById = new Map(leaveData.requests.map((request) => [request._id, request]));
    return selectedDayLeaveEntries
      .map((entry) => requestById.get(entry.requestId))
      .filter((entry): entry is LeaveRequestView => Boolean(entry));
  }, [leaveData, selectedDayLeaveEntries]);

  const selectedDayAttendanceStatus = attendanceByDateKey.get(selectedDateKey)?.dayStatus ?? null;

  const activeRangeStartKey = rangeSelection.startDateKey;
  const activeRangeEndKey = rangeSelection.endDateKey ?? rangeSelection.startDateKey;

  const visibleMonthHolidays = useMemo(
    () =>
      holidayViews.filter(
        (holiday) =>
          holiday.date.getFullYear() === visibleMonth.getFullYear() &&
          holiday.date.getMonth() === visibleMonth.getMonth(),
      ),
    [holidayViews, visibleMonth],
  );

  const latestLeaveRequests = useMemo(
    () => (leaveData?.requests ?? []).slice(0, 8),
    [leaveData],
  );

  const attendanceSummary = attendanceMonthData?.summary ?? {
    presentDays: 0,
    absentDays: 0,
    halfDays: 0,
    totalMarkedDays: 0,
  };

  const loadAttendanceMonth = useCallback(
    async (monthKey: string) => {
      if (!supportsAttendance) {
        return;
      }

      setAttendanceLoading(true);
      setAttendanceNotice(null);

      try {
        const response = await fetch(`/api/attendance/month?month=${monthKey}`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = (await response.json()) as ApiResponse;
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error?.message ?? "Unable to load month attendance.");
        }

        setAttendanceMonthData(payload.data as AttendanceCalendarMonthPayload);
      } catch (error) {
        setAttendanceNotice({
          tone: "error",
          text: error instanceof Error ? error.message : "Unable to load month attendance.",
        });
      } finally {
        setAttendanceLoading(false);
      }
    },
    [supportsAttendance],
  );

  async function loadLeaveData() {
    if (!supportsLeaveApply) {
      return;
    }

    setLeaveLoading(true);

    try {
      const response = await fetch("/api/attendance/leave", {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "Unable to load leave requests.");
      }
      setLeaveData(payload.data as LeavePanelData);
    } catch (error) {
      setLeaveNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Unable to load leave requests.",
      });
    } finally {
      setLeaveLoading(false);
    }
  }

  function handleVisibleMonthChange(nextMonth: Date) {
    setVisibleMonth(nextMonth);
    if (!supportsAttendance) {
      return;
    }

    const nextMonthKey = toMonthKey(nextMonth);
    if (attendanceMonthData?.monthKey === nextMonthKey) {
      return;
    }

    void loadAttendanceMonth(nextMonthKey);
  }

  async function submitLeaveRequest() {
    if (!supportsLeaveApply) {
      return;
    }

    setLeaveActionLoading("apply");
    setLeaveNotice(null);

    try {
      const response = await fetch("/api/attendance/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leaveForm),
      });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Unable to submit leave request.");
      }

      await loadLeaveData();
      setLeaveNotice({ tone: "success", text: "Leave request submitted from calendar." });
      setLeaveForm((previous) => ({
        ...previous,
        reason: "",
      }));
    } catch (error) {
      setLeaveNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Unable to submit leave request.",
      });
    } finally {
      setLeaveActionLoading(null);
    }
  }

  async function cancelLeaveRequest(requestId: string) {
    if (!supportsLeaveApply) {
      return;
    }

    setLeaveActionLoading(`cancel-${requestId}`);
    setLeaveNotice(null);

    try {
      const response = await fetch(`/api/attendance/leave/${requestId}/cancel`, {
        method: "PATCH",
      });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Unable to cancel leave request.");
      }

      await loadLeaveData();
      setLeaveNotice({ tone: "success", text: "Leave request cancelled." });
    } catch (error) {
      setLeaveNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Unable to cancel leave request.",
      });
    } finally {
      setLeaveActionLoading(null);
    }
  }

  function handleCalendarDateClick(dateKey: string, date: Date) {
    setSelectedDateKey(dateKey);
    handleVisibleMonthChange(startOfMonth(date));

    if (!supportsLeaveApply) {
      return;
    }

    setRangeSelection((previous) => {
      if (!previous.startDateKey || (previous.startDateKey && previous.endDateKey)) {
        setLeaveForm((current) => ({
          ...current,
          startDateKey: dateKey,
          endDateKey: dateKey,
        }));

        return {
          startDateKey: dateKey,
          endDateKey: null,
        };
      }

      const orderedRange = getOrderedDateRange(previous.startDateKey, dateKey);
      setLeaveForm((current) => ({
        ...current,
        startDateKey: orderedRange.startDateKey,
        endDateKey: orderedRange.endDateKey,
      }));

      return orderedRange;
    });
  }

  const onPickToday = () => {
    const nextDate = new Date();
    const todayDateKey = toDateKey(nextDate);
    handleVisibleMonthChange(startOfMonth(nextDate));
    setSelectedDateKey(todayDateKey);
    if (supportsLeaveApply) {
      setRangeSelection({
        startDateKey: todayDateKey,
        endDateKey: todayDateKey,
      });
      setLeaveForm((current) => ({
        ...current,
        startDateKey: todayDateKey,
        endDateKey: todayDateKey,
      }));
    }
  };

  return (
    <div className="space-y-4">
      {supportsAttendance ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Leave Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-foreground">
                {leaveData?.balance.availableDays ?? 0}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Available days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Present Days</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-foreground">{attendanceSummary.presentDays}</p>
              <p className="mt-1 text-xs text-muted-foreground">{monthTitleFormatter.format(visibleMonth)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Absent Days</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-foreground">{attendanceSummary.absentDays}</p>
              <p className="mt-1 text-xs text-muted-foreground">{monthTitleFormatter.format(visibleMonth)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Half Days</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-foreground">{attendanceSummary.halfDays}</p>
              <p className="mt-1 text-xs text-muted-foreground">{monthTitleFormatter.format(visibleMonth)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Total Marked</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-foreground">{attendanceSummary.totalMarkedDays}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {attendanceLoading ? "Syncing attendance..." : "Attendance entries"}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {attendanceNotice ? (
        <p className={attendanceNotice.tone === "error" ? "text-sm text-danger" : "text-sm text-success"}>
          {attendanceNotice.text}
        </p>
      ) : null}

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>{monthTitleFormatter.format(visibleMonth)}</CardTitle>
              <CardDescription>Google Calendar style month view</CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleVisibleMonthChange(addMonths(visibleMonth, -1))}
              >
                Prev
              </Button>
              <Button variant="subtle" size="sm" onClick={onPickToday}>
                Today
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleVisibleMonthChange(addMonths(visibleMonth, 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-y border-border bg-[#f8fafc]">
            {WEEKDAY_LABELS.map((day) => (
              <div
                key={day}
                className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {monthCells.map((cell) => {
              const isSelected = cell.dateKey === selectedDateKey;
              const isRangeStart = activeRangeStartKey === cell.dateKey;
              const isRangeEnd = activeRangeEndKey === cell.dateKey;
              const isInSelectedRange =
                activeRangeStartKey && activeRangeEndKey
                  ? isDateWithinRange(cell.dateKey, activeRangeStartKey, activeRangeEndKey)
                  : false;
              const visibleHolidayItems = cell.holidays.slice(0, 2);
              const visibleLeaveItems = cell.leaveEntries.slice(0, 1);
              const attendanceStatusBadge = cell.attendanceStatus
                ? getAttendanceStatusBadge(cell.attendanceStatus)
                : null;
              const moreCount =
                cell.holidays.length +
                cell.leaveEntries.length -
                visibleHolidayItems.length -
                visibleLeaveItems.length -
                (attendanceStatusBadge ? 1 : 0);

              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  onClick={() => handleCalendarDateClick(cell.dateKey, cell.date)}
                  className={cn(
                    "min-h-[96px] border-b border-r border-border p-1.5 text-left transition-colors md:min-h-[112px] md:p-2",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent",
                    cell.inCurrentMonth ? "bg-white" : "bg-[#fafafa] text-muted-foreground/80",
                    isInSelectedRange && !isSelected ? "bg-accent/5" : null,
                    isSelected ? "bg-accent/10" : "hover:bg-surface-soft",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                        cell.isToday ? "bg-accent text-white" : "text-foreground",
                        isRangeStart || isRangeEnd ? "bg-accent text-white" : null,
                        !cell.inCurrentMonth && !cell.isToday ? "text-muted-foreground" : null,
                      )}
                    >
                      {cell.date.getDate()}
                    </span>
                    <div className="flex items-center gap-1">
                      {cell.holidays.length > 0 ? (
                        <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
                      ) : null}
                      {cell.leaveEntries.length > 0 ? (
                        <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
                      ) : null}
                      {attendanceStatusBadge ? (
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            attendanceStatusBadge.variant === "success" && "bg-success",
                            attendanceStatusBadge.variant === "danger" && "bg-danger",
                            attendanceStatusBadge.variant === "warning" && "bg-warning",
                          )}
                          aria-hidden="true"
                        />
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-1 space-y-1">
                    {visibleHolidayItems.map((holiday) => (
                      <p
                        key={holiday.id}
                        className={cn(
                          "truncate rounded px-1.5 py-0.5 text-[10px] font-semibold",
                          holiday.category === "national"
                            ? "border border-[#c7d5e2] bg-[#ecf2f7] text-[#274d6f]"
                            : "border border-[#e8d7b8] bg-[#fbf6eb] text-[#8a5a1f]",
                        )}
                      >
                        {holiday.name}
                      </p>
                    ))}

                    {visibleLeaveItems.map((entry, index) => {
                      const status = getLeaveStatusBadge(entry.status);
                      return (
                        <p
                          key={`${entry.requestId}-${entry.status}-${index}`}
                          className={cn(
                            "truncate rounded px-1.5 py-0.5 text-[10px] font-semibold",
                            getLeaveStatusPillClass(entry.status),
                          )}
                        >
                          Leave {status.label}
                        </p>
                      );
                    })}

                    {attendanceStatusBadge && cell.attendanceStatus ? (
                      <p
                        className={cn(
                          "truncate rounded px-1.5 py-0.5 text-[10px] font-semibold",
                          getAttendanceStatusPillClass(cell.attendanceStatus),
                        )}
                      >
                        {attendanceStatusBadge.label}
                      </p>
                    ) : null}

                    {moreCount > 0 ? (
                      <p className="text-[10px] font-semibold text-muted-foreground">+{moreCount} more</p>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{fullDateFormatter.format(selectedDate)}</CardTitle>
            <CardDescription>{weekdayFormatter.format(selectedDate)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {selectedDayHolidays.length === 0 ? (
              <p className="rounded-lg border border-border bg-white p-3 text-sm text-muted-foreground">
                No holiday on this date.
              </p>
            ) : (
              selectedDayHolidays.map((holiday) => (
                <div
                  key={holiday.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-white p-3"
                >
                  <p className="text-sm font-semibold text-foreground">{holiday.name}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant={holiday.category === "national" ? "accent" : "warning"}>
                      {holiday.category === "national" ? "National" : "Festival"}
                    </Badge>
                    {holiday.isTentative ? <Badge variant="neutral">Tentative</Badge> : null}
                  </div>
                </div>
              ))
            )}

            {supportsAttendance ? (
              selectedDayAttendanceStatus ? (
                <div className="rounded-lg border border-border bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">Attendance Status</p>
                    <Badge variant={getAttendanceStatusBadge(selectedDayAttendanceStatus).variant}>
                      {getAttendanceStatusBadge(selectedDayAttendanceStatus).label}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Marked for {selectedDateKey}
                  </p>
                </div>
              ) : (
                <p className="rounded-lg border border-border bg-white p-3 text-sm text-muted-foreground">
                  Attendance status not marked for this date.
                </p>
              )
            ) : null}

            {supportsLeaveApply ? (
              <>
                <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Your leave status on selected date
                </p>
                {selectedDayLeaveRequests.length === 0 ? (
                  <p className="rounded-lg border border-border bg-white p-3 text-sm text-muted-foreground">
                    No leave mapped on this date.
                  </p>
                ) : (
                  selectedDayLeaveRequests.map((request) => {
                    const status = getLeaveStatusBadge(request.status);
                    const canCancel = request.status === "pending";

                    return (
                      <div key={request._id} className="rounded-lg border border-border bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground">
                            {request.leaveType} leave ({request.totalDays} day{request.totalDays > 1 ? "s" : ""})
                          </p>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {request.startDateKey} to {request.endDateKey}
                        </p>
                        {canCancel ? (
                          <Button
                            className="mt-2"
                            size="sm"
                            variant="secondary"
                            onClick={() => void cancelLeaveRequest(request._id)}
                            disabled={leaveActionLoading !== null || leaveLoading}
                          >
                            {leaveActionLoading === `cancel-${request._id}` ? "Cancelling..." : "Cancel"}
                          </Button>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Holidays This Month</CardTitle>
            <CardDescription>{monthTitleFormatter.format(visibleMonth)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {visibleMonthHolidays.length === 0 ? (
              <p className="rounded-lg border border-border bg-white p-3 text-sm text-muted-foreground">
                No listed holidays in this month.
              </p>
            ) : (
              visibleMonthHolidays.map((holiday) => (
                <div key={holiday.id} className="rounded-lg border border-border bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{holiday.name}</p>
                    <Badge variant={holiday.category === "national" ? "accent" : "warning"}>
                      {holiday.category === "national" ? "National" : "Festival"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{fullDateFormatter.format(holiday.date)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {supportsLeaveApply ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Apply Leave From Calendar</CardTitle>
              <CardDescription>
                Click start date, then end date on calendar to auto-fill the leave range.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-border bg-white p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Available</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {leaveData?.balance.availableDays ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-white p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Pending Days</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {leaveData?.balance.pendingRequestedDays ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-white p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Monthly Credit</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    +{leaveData?.balance.monthlyAccrualDays ?? 0}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="subtle"
                  onClick={() => {
                    setRangeSelection({
                      startDateKey: selectedDateKey,
                      endDateKey: null,
                    });
                    setLeaveForm((previous) => ({
                      ...previous,
                      startDateKey: selectedDateKey,
                      endDateKey: selectedDateKey,
                    }));
                  }}
                  disabled={leaveActionLoading !== null}
                >
                  Start Range From Selected
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setRangeSelection({
                      startDateKey: selectedDateKey,
                      endDateKey: selectedDateKey,
                    });
                    setLeaveForm((previous) => ({
                      ...previous,
                      startDateKey: selectedDateKey,
                      endDateKey: selectedDateKey,
                    }));
                  }}
                  disabled={leaveActionLoading !== null}
                >
                  Single Day
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void loadLeaveData()}
                  disabled={leaveLoading || leaveActionLoading !== null}
                >
                  {leaveLoading ? "Refreshing..." : "Refresh Leave Data"}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                {activeRangeStartKey
                  ? activeRangeEndKey && activeRangeStartKey !== activeRangeEndKey
                    ? `Selected Range: ${activeRangeStartKey} to ${activeRangeEndKey}`
                    : `Selected Date: ${activeRangeStartKey} (click another date to complete range)`
                  : "Click start date and end date on calendar to pick leave range."}
              </p>

              <div className="grid gap-3 md:grid-cols-2">
                <select
                  className="h-11 w-full rounded-lg border border-border bg-white px-3.5 text-sm text-foreground"
                  value={leaveForm.leaveType}
                  onChange={(event) =>
                    setLeaveForm((previous) => ({
                      ...previous,
                      leaveType: event.target.value as LeaveType,
                    }))
                  }
                >
                  {leaveTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <Input
                  type="date"
                  value={leaveForm.startDateKey}
                  onChange={(event) =>
                    setLeaveForm((previous) => ({
                      ...previous,
                      startDateKey: event.target.value,
                    }))
                  }
                  required
                />
                <Input
                  type="date"
                  value={leaveForm.endDateKey}
                  onChange={(event) =>
                    setLeaveForm((previous) => ({
                      ...previous,
                      endDateKey: event.target.value,
                    }))
                  }
                  required
                />
              </div>

              <Textarea
                placeholder="Reason for leave (optional)"
                value={leaveForm.reason}
                onChange={(event) =>
                  setLeaveForm((previous) => ({
                    ...previous,
                    reason: event.target.value,
                  }))
                }
              />

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => void submitLeaveRequest()}
                  disabled={!leaveForm.startDateKey || !leaveForm.endDateKey || leaveActionLoading !== null}
                >
                  {leaveActionLoading === "apply" ? "Submitting..." : "Submit Leave Request"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setRangeSelection({
                      startDateKey: selectedDateKey,
                      endDateKey: selectedDateKey,
                    });
                    setLeaveForm({
                      leaveType: "casual",
                      startDateKey: selectedDateKey,
                      endDateKey: selectedDateKey,
                      reason: "",
                    });
                  }}
                  disabled={leaveActionLoading !== null}
                >
                  Reset
                </Button>
              </div>

              {leaveNotice ? (
                <p className={leaveNotice.tone === "error" ? "text-sm text-danger" : "text-sm text-success"}>
                  {leaveNotice.text}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Leave Requests</CardTitle>
              <CardDescription>Latest requests with quick cancel for pending items.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {latestLeaveRequests.length === 0 ? (
                <p className="rounded-lg border border-border bg-white p-3 text-sm text-muted-foreground">
                  No leave requests yet.
                </p>
              ) : (
                latestLeaveRequests.map((request) => {
                  const status = getLeaveStatusBadge(request.status);
                  const canCancel = request.status === "pending";

                  return (
                    <div key={request._id} className="rounded-lg border border-border bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {request.leaveType} leave ({request.totalDays} day{request.totalDays > 1 ? "s" : ""})
                        </p>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {request.startDateKey} to {request.endDateKey}
                      </p>
                      {request.reason ? (
                        <p className="mt-1 text-xs text-muted-foreground">{request.reason}</p>
                      ) : null}
                      {canCancel ? (
                        <Button
                          className="mt-2"
                          size="sm"
                          variant="secondary"
                          onClick={() => void cancelLeaveRequest(request._id)}
                          disabled={leaveActionLoading !== null || leaveLoading}
                        >
                          {leaveActionLoading === `cancel-${request._id}` ? "Cancelling..." : "Cancel"}
                        </Button>
                      ) : null}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
