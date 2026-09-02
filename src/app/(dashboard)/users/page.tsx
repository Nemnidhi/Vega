import { DashboardHeader } from "@/components/dashboard/header";
import {
  UserManagementPanel,
  type StaffUserItem,
} from "@/components/users/user-management-panel";
import {
  PasswordChangeRequestsPanel,
  type PasswordChangeRequestItem,
} from "@/components/users/password-change-requests-panel";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { getPasswordChangeRequests, getStaffUsers } from "@/lib/dashboard/queries";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await requireRoleAccess(["admin"]);

  const [users, passwordChangeRequests] = (await Promise.all([
    getStaffUsers(),
    getPasswordChangeRequests(),
  ])) as [
    Array<{
    _id: string;
    fullName: string;
    email: string;
    role: StaffUserItem["role"];
    status: StaffUserItem["status"];
    lastLoginAt?: string | null;
    createdAt?: string | null;
    }>,
    PasswordChangeRequestItem[],
  ];

  const initialUsers: StaffUserItem[] = users.map((user) => ({
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.status,
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt ?? null,
  }));

  return (
    <section className="space-y-6">
      <DashboardHeader
        title="User Access"
        subtitle="Admin-only staff access control for creating, updating, and deleting staff users."
      />
      <PasswordChangeRequestsPanel initialRequests={passwordChangeRequests} />
      <UserManagementPanel initialUsers={initialUsers} currentUserId={session.userId} />
    </section>
  );
}
