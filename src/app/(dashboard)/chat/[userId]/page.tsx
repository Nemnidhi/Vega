import { notFound } from "next/navigation";
import { UniversalChat } from "@/components/chat/universal-chat";
import { BackButton } from "@/components/dashboard/back-button";
import { LOGIN_ROLES } from "@/lib/auth/constants";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { connectToDatabase } from "@/lib/db/mongodb";
import { UserModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

export const dynamic = "force-dynamic";

type Params = Promise<{ userId: string }>;

export default async function ChatConversationPage({ params }: { params: Params }) {
  const session = await requireRoleAccess(LOGIN_ROLES, {
    loginPath: "/login",
    redirectTo: "/client/queries",
  });
  const { userId } = await params;

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

  const hasTargetUser = initialUsers.some((item) => item._id === userId);
  if (!hasTargetUser) {
    notFound();
  }

  const target = initialUsers.find((item) => item._id === userId);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        {/* An explicit href, not history: this route is deep-linkable and may open in a fresh tab. */}
        <BackButton href="/chat" label="All chats" />
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold leading-6 text-vega-text">
            {target?.fullName ?? "Conversation"}
          </h1>
          <p className="text-[11px] capitalize text-vega-text-muted">
            {(target?.role ?? "").replaceAll("_", " ")}
          </p>
        </div>
      </div>

      <UniversalChat
        currentUserId={session.userId}
        currentUserLabel={session.fullName ?? session.email}
        initialUsers={initialUsers}
        initialSelectedUserId={userId}
        mobileMode="thread"
        mobileBackHref="/chat"
      />
    </section>
  );
}
