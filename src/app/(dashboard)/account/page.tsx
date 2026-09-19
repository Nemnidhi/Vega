import { PasswordChangeRequestForm } from "@/components/account/password-change-request-form";
import { ProfileWorkspace } from "@/components/account/profile-workspace";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { LOGIN_ROLES } from "@/lib/auth/constants";
import { getAttendanceMonthKey } from "@/lib/attendance/date";
import { getUserProfile } from "@/lib/users/profile";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await requireRoleAccess(LOGIN_ROLES);

  // The same record an admin sees at /users/[id], read for yourself. Reusing it
  // means the two cannot drift into disagreeing about your own attendance.
  const profile = await getUserProfile(session.userId, getAttendanceMonthKey());

  if (!profile) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-vega-text-muted">Your account record could not be loaded.</p>
        <PasswordChangeRequestForm userLabel={session.fullName ?? session.email} />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <ProfileWorkspace data={profile} />
      <PasswordChangeRequestForm userLabel={session.fullName ?? session.email} />
    </section>
  );
}
