import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { fetchDashboardOrganizations, DashboardApiError } from "@/lib/platformAdmin/dashboardClient";

export const dynamic = "force-dynamic";

function planBadgeVariant(plan: string) {
  if (plan === "pro" || plan === "custom") return "success" as const;
  if (plan === "medium") return "accent" as const;
  return "neutral" as const;
}

function billingBadgeVariant(status: string) {
  if (["halted", "past_due", "suspended", "cancelled"].includes(status)) return "danger" as const;
  if (status === "trial") return "warning" as const;
  return "success" as const;
}

// Master plan Phase 7: Vega's control-plane view over every client Organization running on
// Dashboard-WhatsApp - not a new data store, this page calls Dashboard-WhatsApp's own
// /api/platform-admin/organizations directly (server-to-server, see dashboardClient.ts).
export default async function PlatformAdminPage() {
  await requireRoleAccess(["admin"]);

  let organizations: Awaited<ReturnType<typeof fetchDashboardOrganizations>> = [];
  let loadError: string | null = null;

  try {
    organizations = await fetchDashboardOrganizations();
  } catch (error) {
    loadError =
      error instanceof DashboardApiError
        ? error.message
        : "Could not reach Dashboard-WhatsApp. Check DASHBOARD_API_URL/DASHBOARD_INTEGRATION_SECRET.";
  }

  return (
    <section className="space-y-6">
      <DashboardHeader
        title="Platform Admin"
        subtitle="Every client business running on Dashboard-WhatsApp - plan, usage, and onboarding, managed from here."
      />

      <Card>
        <CardHeader>
          <CardTitle>Client Organizations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loadError ? (
            <p className="text-sm text-danger">{loadError}</p>
          ) : organizations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No client organizations on the platform yet.</p>
          ) : (
            organizations.map((organization) => (
              <Link
                key={organization.id}
                href={`/platform-admin/${organization.id}`}
                className="block rounded-lg border border-border bg-vega-surface-1 p-3 hover:bg-surface-soft"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{organization.name}</p>
                    <p className="text-xs text-muted-foreground">{organization.slug}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={planBadgeVariant(organization.plan)}>{organization.plan}</Badge>
                    <Badge variant={billingBadgeVariant(organization.billingStatus)}>{organization.billingStatus}</Badge>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {organization.workspaceCount} workspace{organization.workspaceCount === 1 ? "" : "s"} {"•"}{" "}
                  {organization.memberCount} member{organization.memberCount === 1 ? "" : "s"}
                </p>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}
