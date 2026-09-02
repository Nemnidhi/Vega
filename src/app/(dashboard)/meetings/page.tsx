import { DashboardHeader } from "@/components/dashboard/header";
import { MeetingsView } from "@/components/meetings/meetings-view";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { connectToDatabase } from "@/lib/db/mongodb";
import { MeetingModel, MeetingAvailabilityModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const session = await requireRoleAccess(["admin", "partner", "sales", "project_manager"]);

  await connectToDatabase();
  const [meetings, availability] = await Promise.all([
    MeetingModel.find({ status: "confirmed" })
      .sort({ startAt: 1 })
      .limit(500)
      .populate("clientUserId", "fullName email")
      .populate("assignedToUserId", "fullName")
      .lean(),
    MeetingAvailabilityModel.findOne().lean(),
  ]);

  return (
    <section className="space-y-6">
      <DashboardHeader
        title="Meetings"
        subtitle="Upcoming client bookings, and the shared availability clients can book against."
        showLeadCta={false}
      />
      <MeetingsView
        currentUserRole={session.role}
        initialMeetings={serializeForJson(meetings)}
        initialAvailability={serializeForJson(availability)}
      />
    </section>
  );
}
