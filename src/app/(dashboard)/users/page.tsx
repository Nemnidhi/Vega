import { DashboardHeader } from "@/components/dashboard/header";
import {
  UserManagementPanel,
  type StaffUserItem,
} from "@/components/users/user-management-panel";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { getStaffUsers } from "@/lib/dashboard/queries";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await requireRoleAccess(["admin"]);

  const users = (await getStaffUsers()) as Array<{
    _id: string;
    fullName: string;
    email: string;
    role: StaffUserItem["role"];
    status: StaffUserItem["status"];
    lastLoginAt?: string | null;
    createdAt?: string | null;
  }>;

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
        subtitle="Admin-only staff access control for creating accounts and updating user credentials."
      />
      <UserManagementPanel initialUsers={initialUsers} />
    </section>
  );
}
