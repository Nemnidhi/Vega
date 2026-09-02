import { UniversalChat } from "@/components/chat/universal-chat";
import { BackButton } from "@/components/dashboard/back-button";
import { LOGIN_ROLES } from "@/lib/auth/constants";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { connectToDatabase } from "@/lib/db/mongodb";
import { UserModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const session = await requireRoleAccess(LOGIN_ROLES, {
    loginPath: "/login",
    redirectTo: "/client/queries",
  });

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
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <BackButton href="/dashboard" label="Dashboard" />
        <div className="min-w-0">
          <h1 className="text-base font-semibold leading-6 text-vega-text">Chat</h1>
          <p className="text-[11px] text-vega-text-muted">Message anyone on the Vega team.</p>
        </div>
      </div>

      <UniversalChat
        currentUserId={session.userId}
        currentUserLabel={session.fullName ?? session.email}
        initialUsers={initialUsers}
        mobileMode="people"
      />
    </section>
  );
}
