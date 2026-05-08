import { ClientQueryPortal } from "@/components/client/client-query-portal";
import { LogoutButton } from "@/components/auth/logout-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { connectToDatabase } from "@/lib/db/mongodb";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { ClientOnboardingModel, ClientQueryModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

export const dynamic = "force-dynamic";

type InitialOnboarding = {
  companyName: string;
  primaryGoal: string;
  kickoffDate: string | null;
  preferredCommunication: "email" | "phone" | "whatsapp" | "slack" | "meetings";
  billingContactEmail: string;
  projectBrief: string;
  onboardingNotes: string;
  checklist: {
    accountSetup: boolean;
    businessProfile: boolean;
    requirementsShared: boolean;
    documentsShared: boolean;
    kickoffCallBooked: boolean;
  };
};

const defaultOnboarding: InitialOnboarding = {
  companyName: "",
  primaryGoal: "",
  kickoffDate: null,
  preferredCommunication: "email",
  billingContactEmail: "",
  projectBrief: "",
  onboardingNotes: "",
  checklist: {
    accountSetup: false,
    businessProfile: false,
    requirementsShared: false,
    documentsShared: false,
    kickoffCallBooked: false,
  },
};

export default async function ClientQueriesPage() {
  const session = await requireRoleAccess(["client"], {
    loginPath: "/client/login",
    redirectTo: "/dashboard",
  });

  await connectToDatabase();
  const records = await ClientQueryModel.find({ raisedBy: session.userId })
    .sort({ createdAt: -1 })
    .lean();
  const onboardingRecord = await ClientOnboardingModel.findOne({
    clientUserId: session.userId,
  }).lean();

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
  const initialOnboarding = serializeForJson(
    onboardingRecord ?? defaultOnboarding,
  ) as InitialOnboarding;

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl space-y-4 p-3 sm:space-y-6 sm:p-4 md:p-7 lg:p-8">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Client Query Portal</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Signed in as {session.fullName ?? session.email}
              </p>
            </div>
            <LogoutButton redirectTo="/client/login" className="w-full sm:w-auto" />
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
        initialOnboarding={initialOnboarding}
        clientName={session.fullName ?? session.email}
      />
    </main>
  );
}
