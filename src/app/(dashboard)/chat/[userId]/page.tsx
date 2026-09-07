import { notFound } from "next/navigation";
import { UniversalChat } from "@/components/chat/universal-chat";
import { ChatPageChrome } from "@/components/chat/chat-page-chrome";
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

  return (
    <section>
      <ChatPageChrome thread />
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
