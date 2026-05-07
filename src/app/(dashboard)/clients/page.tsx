import Link from "next/link";
import { ClientOnboardingForm } from "@/components/clients/client-onboarding-form";
import { DashboardHeader } from "@/components/dashboard/header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getClients } from "@/lib/dashboard/queries";
import { requireRoleAccess } from "@/lib/auth/role-access";

export const dynamic = "force-dynamic";

function onboardingBadgeVariant(status: "pending" | "in_progress" | "completed") {
  if (status === "completed") return "success" as const;
  if (status === "in_progress") return "warning" as const;
  return "neutral" as const;
}

function humanizeStatus(status: "pending" | "in_progress" | "completed") {
  return status.replaceAll("_", " ").replace(/\b\w/g, (value) => value.toUpperCase());
}

export default async function ClientsPage() {
  const session = await requireRoleAccess(["admin", "sales"]);

  const clients = (await getClients()) as Array<{
    _id: string;
    legalName: string;
    primaryContactName: string;
    primaryContactEmail: string;
    primaryContactPhone?: string;
    preferredCommunication?: "email" | "phone" | "whatsapp" | "slack" | "meetings";
    requirementSummary?: string;
    onboardingStatus?: "pending" | "in_progress" | "completed";
    onboardedAt?: string | null;
  }>;

  return (
    <section className="space-y-6">
      <DashboardHeader
        title="Clients"
        subtitle="Onboard clients, capture requirements, and access vault views."
      />

      {session.role === "admin" ? <ClientOnboardingForm /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Client Accounts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No clients available.</p>
          ) : (
            clients.map((client) => (
              <Link
                key={client._id}
                href={`/clients/${client._id}/vault`}
                className="block rounded-lg border border-border bg-white p-3 hover:bg-surface-soft"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{client.legalName}</p>
                    <p className="text-xs text-muted-foreground">
                      {client.primaryContactName} {"\u2022"} {client.primaryContactEmail}
                    </p>
                    {client.primaryContactPhone ? (
                      <p className="text-xs text-muted-foreground">{client.primaryContactPhone}</p>
                    ) : null}
                  </div>
                  <Badge variant={onboardingBadgeVariant(client.onboardingStatus ?? "pending")}>
                    {humanizeStatus(client.onboardingStatus ?? "pending")}
                  </Badge>
                </div>

                {client.requirementSummary ? (
                  <p className="mt-2 text-xs text-muted-foreground">{client.requirementSummary}</p>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Requirement summary not added yet.
                  </p>
                )}

                {client.preferredCommunication ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Preferred communication: {client.preferredCommunication}
                  </p>
                ) : null}

                {client.onboardedAt ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Onboarded: {new Date(client.onboardedAt).toLocaleDateString("en-IN")}
                  </p>
                ) : null}
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}
