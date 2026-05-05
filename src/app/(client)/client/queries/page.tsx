import { ClientQueryPortal } from "@/components/client/client-query-portal";
import { LogoutButton } from "@/components/auth/logout-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { connectToDatabase } from "@/lib/db/mongodb";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { ClientQueryModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

export const dynamic = "force-dynamic";

export default async function ClientQueriesPage() {
  const session = await requireRoleAccess(["client"], {
    loginPath: "/client/login",
    redirectTo: "/dashboard",
  });

  await connectToDatabase();
  const records = await ClientQueryModel.find({ raisedBy: session.userId })
    .sort({ createdAt: -1 })
    .lean();

  const initialQueries = serializeForJson(records) as Array<{
    _id: string;
    projectName: string;
    subject: string;
    message: string;
    priority: "low" | "medium" | "high";
    status: "open" | "in_progress" | "resolved";
    createdAt: string;
    updatedAt: string;
  }>;

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl space-y-6 p-4 md:p-7 lg:p-8">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Client Query Portal</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Signed in as {session.fullName ?? session.email}
              </p>
            </div>
            <LogoutButton redirectTo="/client/login" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Raise project-related questions and track their status.
          </p>
        </CardContent>
      </Card>

      <ClientQueryPortal
        initialQueries={initialQueries}
        clientName={session.fullName ?? session.email}
      />
    </main>
  );
}
