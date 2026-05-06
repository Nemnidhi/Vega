import { DashboardHeader } from "@/components/dashboard/header";
import { HolidayCalendarView } from "@/components/calendar/holiday-calendar-view";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { attendanceMemberRoles } from "@/lib/attendance/constants";
import { getAttendanceMonthKey } from "@/lib/attendance/date";
import {
  getAttendanceCalendarMonth,
  getLeaveRequestsForUser,
} from "@/lib/attendance/queries";
import { INDIA_HOLIDAYS_2026 } from "@/lib/calendar/india-holidays-2026";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const session = await requireRoleAccess(["admin", "sales", "developer"]);
  const isAttendanceMember = attendanceMemberRoles.includes(session.role);
  const initialMonthKey = getAttendanceMonthKey();

  const [initialLeaveData, initialAttendanceData] = isAttendanceMember
    ? await Promise.all([
        getLeaveRequestsForUser(session.userId),
        getAttendanceCalendarMonth(session.userId, initialMonthKey),
      ])
    : [null, null];

  return (
    <section className="space-y-6">
      <DashboardHeader
        title="Holiday Calendar"
        subtitle="Google Calendar style holiday view with national and festival coverage."
        showLeadCta={false}
      />

      <HolidayCalendarView
        holidays={INDIA_HOLIDAYS_2026}
        initialLeaveData={initialLeaveData}
        initialAttendanceData={initialAttendanceData}
      />

      <p className="text-xs text-muted-foreground">
        Note: Lunar-date holidays (Eid, Muharram, Milad-un-Nabi) can shift based on moon
        sighting notifications.
      </p>
    </section>
  );
}
