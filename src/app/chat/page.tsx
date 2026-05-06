import { UniversalChat } from "@/components/chat/universal-chat";
import { DashboardTopNav } from "@/components/dashboard/top-nav";
import { LOGIN_ROLES } from "@/lib/auth/constants";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { connectToDatabase } from "@/lib/db/mongodb";
import { UserModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";
import type { UserRole } from "@/types/user";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const session = await requireRoleAccess(LOGIN_ROLES, {
    loginPath: "/login",
    redirectTo: "/client/queries",
  });
  const loginRole = session.role as (typeof LOGIN_ROLES)[number];

  await connectToDatabase();
  const users = await UserModel.find({
    _id: { $ne: session.userId },
    status: "active",
    role: { $in: LOGIN_ROLES },
  })
    .sort({ fullName: 1 })
    .select("fullName email role status")
    .lean();

  const initialUsers = serializeForJson(users) as Array<{
    _id: string;
    fullName: string;
    email: string;
    role: string;
    status: string;
  }>;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1300px] space-y-6 p-4 md:p-7 lg:p-8">
      <DashboardTopNav
        role={loginRole as UserRole}
        userLabel={session.fullName ?? session.email}
      />

      <UniversalChat
        currentUserId={session.userId}
        currentUserLabel={session.fullName ?? session.email}
        initialUsers={initialUsers}
      />
    </main>
  );
}
