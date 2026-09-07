import { DashboardHeader } from "@/components/dashboard/header";
import { HolidayCalendarView } from "@/components/calendar/holiday-calendar-view";
import { FollowUpsWorkspace, type FollowUpsWorkspaceItem } from "@/components/leads/follow-ups-workspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { attendanceMemberRoles } from "@/lib/attendance/constants";
import { getAttendanceMonthKey } from "@/lib/attendance/date";
import {
  getAttendanceCalendarMonth,
  getLeaveRequestsForUser,
} from "@/lib/attendance/queries";
import { INDIA_HOLIDAYS_2026 } from "@/lib/calendar/india-holidays-2026";
import { connectToDatabase } from "@/lib/db/mongodb";
import { serializeForJson } from "@/lib/utils/serialize";
import { LeadFollowUpModel } from "@/models";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const session = await requireRoleAccess(["admin", "sales", "digital_marketing", "developer"]);
  const isAttendanceMember = attendanceMemberRoles.includes(session.role);
  const canViewFollowUps = ["admin", "sales", "digital_marketing"].includes(session.role);
  const initialMonthKey = getAttendanceMonthKey();

  const [initialLeaveData, initialAttendanceData] = isAttendanceMember
    ? await Promise.all([
        getLeaveRequestsForUser(session.userId),
        getAttendanceCalendarMonth(session.userId, initialMonthKey),
      ])
    : [null, null];
  const followUps = canViewFollowUps
    ? await (async () => {
        await connectToDatabase();
        const followUpDocs = await LeadFollowUpModel.find({})
          .sort({ status: 1, dueAt: 1 })
          .limit(500)
          .select(
            "leadId status channel priority dueAt nextAction notes outcome outcomeNote assignedToUserId createdAt updatedAt",
          )
          .populate("leadId", "title contactName email phone status")
          .populate("assignedToUserId", "fullName email role")
          .lean();
        return serializeForJson(followUpDocs) as FollowUpsWorkspaceItem[];
      })()
    : [];

  return (
    <section className="space-y-6">
      <DashboardHeader
        title="Calendar"
        subtitle="Holidays, attendance, and lead follow-ups in one workspace."
        showLeadCta={false}
      />

      <HolidayCalendarView
        holidays={INDIA_HOLIDAYS_2026}
        initialLeaveData={initialLeaveData}
        initialAttendanceData={initialAttendanceData}
        followUps={followUps}
      />

      {canViewFollowUps ? (
        <Card>
          <CardHeader>
            <CardTitle>Follow-up Workspace</CardTitle>
          </CardHeader>
          <CardContent>
            <FollowUpsWorkspace followUps={followUps} />
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>A well-planned day leads to bigger achievements.</p>
        <p>Vega - Operations Calendar</p>
      </div>
    </section>
  );
}
