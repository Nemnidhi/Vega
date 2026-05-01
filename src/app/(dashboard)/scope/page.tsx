import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLeads } from "@/lib/dashboard/queries";

export const dynamic = "force-dynamic";

export default async function ScopeIndexPage() {
  const leads = (await getLeads()) as Array<{ _id: string; title: string; status: string }>;

  return (
    <section className="space-y-6">
      <DashboardHeader
        title="Scope-Lock Vault"
        subtitle="Select a lead and complete discovery before project conversion."
      />

      <Card>
        <CardHeader>
          <CardTitle>Leads Pending Scope Manifest</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {leads.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leads available.</p>
          ) : (
            leads.map((lead) => (
              <Link
                key={lead._id}
                href={`/scope/${lead._id}`}
                className="flex items-center justify-between rounded-lg border border-border bg-white p-3 hover:bg-surface-soft"
              >
                <span className="font-medium">{lead.title}</span>
                <span className="text-xs text-muted-foreground">{lead.status}</span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}
