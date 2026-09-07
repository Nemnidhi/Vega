"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CalendarCheck,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Phone,
  Plus,
} from "lucide-react";
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
  followUps?: CalendarFollowUp[];
};

type HolidayWithDate = IndiaHoliday & {
  date: Date;
};

type CalendarLeadRef =
  | string
  | {
      _id: string;
      title?: string;
      contactName?: string;
      email?: string;
      phone?: string;
      status?: string;
    }
  | null;

export type CalendarFollowUp = {
  _id: string;
  leadId: CalendarLeadRef;
  status: string;
  channel: string;
  priority: string;
  dueAt: string;
  nextAction: string;
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
  followUps: CalendarFollowUp[];
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

function leadTitle(lead: CalendarLeadRef) {
  if (!lead || typeof lead === "string") return "Unknown lead";
  return lead.title || lead.contactName || "Untitled lead";
}

function leadIdValue(lead: CalendarLeadRef) {
  if (!lead) return "";
  return typeof lead === "string" ? lead : lead._id;
}

function formatFollowUpTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFollowUpAccentClass(priority: string) {
  if (priority === "urgent") return "border-danger/40 bg-danger/15 text-danger";
  if (priority === "high") return "border-warning/45 bg-warning/15 text-warning";
  if (priority === "medium") return "border-vega-accent-border bg-vega-accent-soft text-[#93c5fd]";
  return "border-success/35 bg-success/10 text-success";
}

function getFollowUpDotClass(priority: string) {
  if (priority === "urgent") return "bg-danger";
  if (priority === "high") return "bg-warning";
  if (priority === "medium") return "bg-vega-accent";
  return "bg-success";
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
  return "border border-border bg-vega-surface-1 text-muted-foreground";
}

function getAttendanceStatusBadge(status: AttendanceDayStatus) {
  if (status === "present") {
    return { label: "Present", shortLabel: "P", variant: "success" as const };
  }
  if (status === "absent") {
    return { label: "Absent", shortLabel: "A", variant: "danger" as const };
  }
  if (status === "late_coming") {
    return { label: "Late Coming", shortLabel: "L", variant: "accent" as const };
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
  if (status === "late_coming") {
    return "border border-[#c8c7e8] bg-[#f0effb] text-[#4b4797]";
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
  followUpsByDateKey: Map<string, CalendarFollowUp[]>,
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
    const dayFollowUps = followUpsByDateKey.get(dateKey) ?? [];
    const leaveEntries = leaveByDateKey.get(dateKey) ?? [];
    const attendanceStatus = attendanceByDateKey.get(dateKey)?.dayStatus ?? null;

    cells.push({
      date,
      dateKey,
      inCurrentMonth: isSameMonth(date, currentMonthStart),
      isToday: dateKey === todayKey,
      holidays: dayHolidays,
      followUps: dayFollowUps,
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
  followUps = [],
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

  const followUpsByDateKey = useMemo(() => {
    const map = new Map<string, CalendarFollowUp[]>();

    for (const followUp of followUps) {
      if (followUp.status !== "scheduled") continue;
      const dueDate = new Date(followUp.dueAt);
      if (Number.isNaN(dueDate.getTime())) continue;
      const dateKey = toDateKey(dueDate);
      const entries = map.get(dateKey) ?? [];
      entries.push(followUp);
      entries.sort((left, right) => new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime());
      map.set(dateKey, entries);
    }

    return map;
  }, [followUps]);

  const today = new Date();
  const firstHolidayDate = holidayViews[0]?.date ?? today;
  const initialMonthSeed = today.getFullYear() === firstHolidayDate.getFullYear() ? today : firstHolidayDate;
  const initialMonth = startOfMonth(initialMonthSeed);
  const firstHolidayInInitialMonth = holidayViews.find((holiday) => isSameMonth(holiday.date, initialMonth));
  const initialDate =
    firstHolidayInInitialMonth?.date ?? (isSameMonth(today, initialMonth) ? today : initialMonth);
  const initialDateKey = toDateKey(initialDate);

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

  const [visibleMonth, setVisibleMonth] = useState<Date>(initialMonth);
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
    () =>
      buildMonthGrid(
        visibleMonth,
        holidaysByDateKey,
        followUpsByDateKey,
        leaveByDateKey,
        attendanceByDateKey,
      ),
    [visibleMonth, holidaysByDateKey, followUpsByDateKey, leaveByDateKey, attendanceByDateKey],
  );

  const selectedDate = useMemo(() => parseDateKey(selectedDateKey), [selectedDateKey]);
  const selectedDayHolidays = holidaysByDateKey.get(selectedDateKey) ?? [];
  const selectedDayFollowUps = followUpsByDateKey.get(selectedDateKey) ?? [];
  const selectedDayLeaveEntries = useMemo(
    () => leaveByDateKey.get(selectedDateKey) ?? [],
    [leaveByDateKey, selectedDateKey],
  );

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
    lateComingDays: 0,
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

  const selectedDayAgendaCount =
    selectedDayFollowUps.length +
    selectedDayHolidays.length +
    selectedDayLeaveEntries.length +
    (selectedDayAttendanceStatus ? 1 : 0);

  return (
    <div className="space-y-4">
      {attendanceNotice ? (
        <p className={attendanceNotice.tone === "error" ? "text-sm text-danger" : "text-sm text-success"}>
          {attendanceNotice.text}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid w-full grid-cols-4 rounded-lg border border-vega-border-soft bg-vega-surface-1 p-1 xl:inline-flex xl:w-fit xl:grid-cols-none">
          {["Month", "Week", "Day", "List"].map((item) => (
            <button
              key={item}
              type="button"
              className={cn(
                "h-11 rounded-md px-5 text-base font-semibold text-vega-text-muted transition-colors xl:h-9 xl:text-sm",
                item === "Month" ? "bg-vega-accent text-white shadow-sm" : "hover:bg-vega-surface-hover hover:text-vega-text",
              )}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="h-12 w-12 px-0 xl:h-8 xl:w-auto xl:px-2.5"
            onClick={() => handleVisibleMonthChange(addMonths(visibleMonth, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button variant="subtle" size="sm" className="h-12 px-6 text-base xl:h-8 xl:px-2.5 xl:text-xs" onClick={onPickToday}>
            Today
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-12 w-12 px-0 xl:h-8 xl:w-auto xl:px-2.5"
            onClick={() => handleVisibleMonthChange(addMonths(visibleMonth, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Link
            href="/meetings"
            className="ml-auto inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-vega-accent px-5 text-base font-semibold text-white transition-colors hover:bg-vega-accent-strong xl:ml-0 xl:h-9 xl:rounded-md xl:px-4 xl:text-sm"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="xl:hidden">Event</span>
            <span className="hidden xl:inline">Add Event</span>
          </Link>
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-2xl">{monthTitleFormatter.format(visibleMonth)}</CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            <div className="grid grid-cols-7 border-b border-border bg-vega-surface-2">
              {WEEKDAY_LABELS.map((day) => (
                <div
                  key={day}
                  className="px-2 py-3 text-center text-base font-semibold text-vega-text-muted xl:text-xs"
                >
                  <span className="xl:hidden">{day[0]}</span>
                  <span className="hidden xl:inline">{day}</span>
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
                const visibleHolidayItems = cell.holidays.slice(0, 1);
                const visibleFollowUpItems = cell.followUps.slice(0, 2);
                const visibleLeaveItems = cell.leaveEntries.slice(0, 1);
                const attendanceStatusBadge = cell.attendanceStatus
                  ? getAttendanceStatusBadge(cell.attendanceStatus)
                  : null;
                const moreCount =
                  cell.holidays.length +
                  cell.followUps.length +
                  cell.leaveEntries.length -
                  visibleHolidayItems.length -
                  visibleFollowUpItems.length -
                  visibleLeaveItems.length -
                  (attendanceStatusBadge ? 1 : 0);

                return (
                  <button
                    key={cell.dateKey}
                    type="button"
                    onClick={() => handleCalendarDateClick(cell.dateKey, cell.date)}
                    className={cn(
                      "min-h-[62px] border-b border-r border-border p-1.5 text-center transition-colors sm:min-h-[78px] xl:min-h-[104px] xl:p-2 xl:text-left 2xl:min-h-[118px]",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent",
                      cell.inCurrentMonth ? "bg-vega-surface-1" : "bg-vega-surface-2/60 text-vega-text-dim",
                      isInSelectedRange && !isSelected ? "bg-vega-accent-soft/50" : null,
                      isSelected ? "bg-vega-accent-soft ring-1 ring-inset ring-vega-accent-border" : "hover:bg-vega-surface-hover",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "inline-flex h-10 w-10 items-center justify-center rounded-full text-lg font-semibold xl:h-7 xl:w-7 xl:text-sm",
                          cell.isToday ? "bg-vega-accent text-white" : "text-vega-text",
                          isRangeStart || isRangeEnd ? "bg-vega-accent text-white" : null,
                          !cell.inCurrentMonth && !cell.isToday ? "text-vega-text-dim" : null,
                        )}
                      >
                        {cell.date.getDate()}
                      </span>
                      <div className="flex items-center gap-1">
                        {cell.holidays.length > 0 ? (
                          <span className="h-2 w-2 rounded-full bg-pink-400" aria-hidden="true" />
                        ) : null}
                        {cell.followUps.length > 0 ? (
                          <span className="h-2 w-2 rounded-full bg-warning" aria-hidden="true" />
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
                              attendanceStatusBadge.variant === "accent" && "bg-accent",
                            )}
                            aria-hidden="true"
                          />
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-1 flex justify-center gap-1 xl:hidden">
                      {cell.holidays.length > 0 ? <span className="h-2 w-2 rounded-full bg-pink-400" /> : null}
                      {cell.followUps.length > 0 ? <span className="h-2 w-2 rounded-full bg-success" /> : null}
                      {cell.leaveEntries.length > 0 || attendanceStatusBadge ? <span className="h-2 w-2 rounded-full bg-vega-accent" /> : null}
                    </div>

                    <div className="mt-2 hidden space-y-1 xl:block">
                      {visibleHolidayItems.map((holiday) => (
                        <p
                          key={holiday.id}
                          className="truncate rounded border border-warning/30 bg-warning/15 px-1.5 py-1 text-[10px] font-semibold text-warning"
                        >
                          {holiday.name}
                        </p>
                      ))}

                      {visibleFollowUpItems.map((followUp) => (
                        <p
                          key={followUp._id}
                          className={cn(
                            "truncate rounded border px-1.5 py-1 text-[10px] font-semibold",
                            getFollowUpAccentClass(followUp.priority),
                          )}
                          title={`${formatFollowUpTime(followUp.dueAt)} ${leadTitle(followUp.leadId)} - ${followUp.nextAction}`}
                        >
                          {formatFollowUpTime(followUp.dueAt)} {leadTitle(followUp.leadId)}
                        </p>
                      ))}

                      {visibleLeaveItems.map((entry, index) => {
                        const status = getLeaveStatusBadge(entry.status);
                        return (
                          <p
                            key={`${entry.requestId}-${entry.status}-${index}`}
                            className={cn(
                              "truncate rounded px-1.5 py-1 text-[10px] font-semibold",
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
                            "truncate rounded px-1.5 py-1 text-[10px] font-semibold",
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
          <div className="flex gap-5 border-t border-border px-4 py-3 text-sm text-vega-text-muted xl:hidden">
            <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-vega-accent" />Meetings</span>
            <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-warning" />Calls</span>
            <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-success" />Follow-ups</span>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="border-b border-border pb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardDescription>{weekdayFormatter.format(selectedDate)}</CardDescription>
                  <CardTitle className="mt-1 text-xl">{fullDateFormatter.format(selectedDate)}</CardTitle>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-vega-surface-1 text-vega-text-muted">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-vega-text">Selected Day Events</p>
                <span className="text-xs font-semibold text-[#93c5fd]">{selectedDayAgendaCount} total</span>
              </div>

              {selectedDayFollowUps.map((followUp) => {
                const leadId = leadIdValue(followUp.leadId);

                return (
                  <div
                    key={followUp._id}
                    className="rounded-md border border-border bg-vega-surface-1 p-3"
                  >
                    <div className="flex gap-3">
                      <span
                        className={cn("mt-1 h-3 w-3 shrink-0 rounded-full", getFollowUpDotClass(followUp.priority))}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-vega-text">
                          {leadId ? (
                            <Link href={`/leads/${leadId}`} className="hover:text-accent hover:underline">
                              {leadTitle(followUp.leadId)}
                            </Link>
                          ) : (
                            leadTitle(followUp.leadId)
                          )}
                        </p>
                        <p className="mt-1 text-xs text-vega-text-muted">
                          {formatFollowUpTime(followUp.dueAt)} - {followUp.nextAction}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="accent">{followUp.channel}</Badge>
                          <Badge variant={followUp.priority === "urgent" ? "danger" : "warning"}>
                            {followUp.priority}
                          </Badge>
                        </div>
                      </div>
                      <Link
                        href={leadId ? `/leads/${leadId}` : "/leads"}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-vega-surface-2 text-vega-text-muted transition-colors hover:border-vega-accent-border hover:text-vega-text"
                        aria-label="Open lead"
                      >
                        <Phone className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                );
              })}

              {selectedDayFollowUps.length === 0 ? (
                <div className="rounded-md border border-border bg-vega-surface-1 p-6 text-center">
                  <CalendarCheck className="mx-auto h-8 w-8 text-vega-text-dim" aria-hidden="true" />
                  <p className="mt-3 text-sm font-medium text-vega-text-muted">No scheduled follow-ups</p>
                </div>
              ) : null}

              {selectedDayHolidays.map((holiday) => (
                <div key={holiday.id} className="rounded-md border border-border bg-vega-surface-1 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-vega-text">{holiday.name}</p>
                    <Badge variant={holiday.category === "national" ? "accent" : "warning"}>
                      {holiday.category === "national" ? "National" : "Festival"}
                    </Badge>
                  </div>
                </div>
              ))}

              {supportsAttendance && selectedDayAttendanceStatus ? (
                <div className="rounded-md border border-border bg-vega-surface-1 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-vega-text">Attendance</p>
                    <Badge variant={getAttendanceStatusBadge(selectedDayAttendanceStatus).variant}>
                      {getAttendanceStatusBadge(selectedDayAttendanceStatus).label}
                    </Badge>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Holidays This Month</CardTitle>
                <span className="text-xs font-semibold text-[#93c5fd]">{visibleMonthHolidays.length}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-4">
              {visibleMonthHolidays.length === 0 ? (
                <p className="rounded-md border border-border bg-vega-surface-1 p-3 text-sm text-muted-foreground">
                  No listed holidays in this month.
                </p>
              ) : (
                visibleMonthHolidays.slice(0, 4).map((holiday) => (
                  <div key={holiday.id} className="rounded-md border border-border bg-vega-surface-1 p-3">
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

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Link href="/meetings" className="rounded-md border border-blue-400/30 bg-blue-500/20 p-3 text-center text-xs font-semibold text-blue-100">
                <CalendarDays className="mx-auto mb-2 h-5 w-5" aria-hidden="true" />
                Add Meeting
              </Link>
              <Link href="/calendar" className="rounded-md border border-success/30 bg-success/15 p-3 text-center text-xs font-semibold text-success">
                <CalendarCheck className="mx-auto mb-2 h-5 w-5" aria-hidden="true" />
                Add Holiday
              </Link>
              <Link href="/leads" className="rounded-md border border-vega-accent-border bg-vega-accent-soft p-3 text-center text-xs font-semibold text-[#93c5fd]">
                <Bell className="mx-auto mb-2 h-5 w-5" aria-hidden="true" />
                Set Reminder
              </Link>
              <Link href="/tasks" className="rounded-md border border-warning/30 bg-warning/15 p-3 text-center text-xs font-semibold text-warning">
                <CheckSquare className="mx-auto mb-2 h-5 w-5" aria-hidden="true" />
                Create Task
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {supportsAttendance ? (
        <Card>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-6">
            {[
              ["Leave Balance", leaveData?.balance.availableDays ?? 0, "Available days"],
              ["Present Days", attendanceSummary.presentDays, monthTitleFormatter.format(visibleMonth)],
              ["Absent Days", attendanceSummary.absentDays, monthTitleFormatter.format(visibleMonth)],
              ["Half Days", attendanceSummary.halfDays, monthTitleFormatter.format(visibleMonth)],
              ["Late Coming", attendanceSummary.lateComingDays, monthTitleFormatter.format(visibleMonth)],
              ["Total Marked", attendanceSummary.totalMarkedDays, attendanceLoading ? "Syncing..." : "Entries"],
            ].map(([label, value, hint]) => (
              <div key={label} className="rounded-md border border-border bg-vega-surface-1 p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

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
                <div className="rounded-lg border border-border bg-vega-surface-1 p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Available</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {leaveData?.balance.availableDays ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-vega-surface-1 p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Pending Days</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {leaveData?.balance.pendingRequestedDays ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-vega-surface-1 p-3">
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
                  className="h-11 w-full rounded-lg border border-border bg-vega-surface-1 px-3.5 text-sm text-foreground"
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
                <p className="rounded-lg border border-border bg-vega-surface-1 p-3 text-sm text-muted-foreground">
                  No leave requests yet.
                </p>
              ) : (
                latestLeaveRequests.map((request) => {
                  const status = getLeaveStatusBadge(request.status);
                  const canCancel = request.status === "pending";

                  return (
                    <div key={request._id} className="rounded-lg border border-border bg-vega-surface-1 p-3">
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
