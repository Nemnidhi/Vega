import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { UniversalChat } from "@/components/chat/universal-chat";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LOGIN_ROLES, getStaffHomeRoute } from "@/lib/auth/constants";
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
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Universal Chat</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Team members can chat with each other.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={getStaffHomeRoute(loginRole)}>
                <Button variant="secondary" size="sm">
                  Back
                </Button>
              </Link>
              <LogoutButton redirectTo="/login" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Signed in as {session.fullName ?? session.email} ({session.role.replaceAll("_", " ")}
            )
          </p>
        </CardContent>
      </Card>

      <UniversalChat
        currentUserId={session.userId}
        currentUserLabel={session.fullName ?? session.email}
        initialUsers={initialUsers}
      />
    </main>
  );
}
