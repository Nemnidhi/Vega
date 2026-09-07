import type { StaffUserItem } from "@/components/users/user-management-panel";
import type { PasswordChangeRequestItem } from "@/components/users/password-change-requests-panel";
import { UsersAccessWorkspace } from "@/components/users/users-access-workspace";
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
    <UsersAccessWorkspace
      initialUsers={initialUsers}
      initialRequests={passwordChangeRequests}
      currentUserId={session.userId}
      userLabel={session.fullName ?? session.email}
      userRole={session.role}
    />
  );
}
