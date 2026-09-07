import { DashboardHeader } from "@/components/dashboard/header";
import { PasswordChangeRequestForm } from "@/components/account/password-change-request-form";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { LOGIN_ROLES } from "@/lib/auth/constants";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await requireRoleAccess(LOGIN_ROLES);

  return (
    <section className="space-y-6">
      <DashboardHeader
        title="Account"
        subtitle="Manage your staff account security request."
        showLeadCta={false}
      />

      <PasswordChangeRequestForm userLabel={session.fullName ?? session.email} />
    </section>
  );
}
