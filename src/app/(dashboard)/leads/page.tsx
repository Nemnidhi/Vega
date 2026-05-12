import { DashboardHeader } from "@/components/dashboard/header";
import { LeadIntakeForms } from "@/components/leads/lead-intake-forms";
import { LeadListWithStatusTabs } from "@/components/leads/lead-list-with-status-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLeads } from "@/lib/dashboard/queries";
import { requireRoleAccess } from "@/lib/auth/role-access";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  await requireRoleAccess(["admin", "sales"]);

  const leads = (await getLeads({ limit: 200 })) as Array<{
    _id: string;
    title: string;
    contactName: string;
    source: string;
    status: string;
    updatedAt?: string;
  }>;

  return (
    <section className="space-y-6">
      <DashboardHeader
        title="Leads"
        subtitle="Create, update, and track leads in a simple CRM flow."
      />

      <LeadIntakeForms />

      <Card>
        <CardHeader>
          <CardTitle>Lead List</CardTitle>
          <p className="text-sm text-muted-foreground">
            Showing latest 200 leads for faster loading. Open any lead for full actions.
          </p>
        </CardHeader>
        <CardContent>
          <LeadListWithStatusTabs leads={leads} />
        </CardContent>
      </Card>
    </section>
  );
}
