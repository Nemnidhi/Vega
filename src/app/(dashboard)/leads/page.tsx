import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/header";
import { LeadIntakeForms } from "@/components/leads/lead-intake-forms";
import { LeadStatusSelect } from "@/components/leads/lead-status-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLeads } from "@/lib/dashboard/queries";
import { requireRoleAccess } from "@/lib/auth/role-access";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  await requireRoleAccess(["admin", "sales"]);

  const leads = (await getLeads()) as Array<{
    _id: string;
    title: string;
    contactName: string;
    email: string;
    source: string;
    status: string;
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
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-2 py-2">Lead</th>
                <th className="px-2 py-2">Source</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">View</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead._id} className="border-b border-border/70">
                  <td className="px-2 py-3">
                    <p className="font-semibold text-foreground">{lead.title}</p>
                    <p className="text-xs text-muted-foreground">{lead.contactName}</p>
                  </td>
                  <td className="px-2 py-3">{lead.source.replaceAll("_", " ")}</td>
                  <td className="px-2 py-3">
                    <LeadStatusSelect leadId={lead._id} currentStatus={lead.status} />
                  </td>
                  <td className="px-2 py-3">
                    <Link href={`/leads/${lead._id}`} className="text-accent hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-2 py-6 text-center text-muted-foreground">
                    No leads yet. Create the first lead above.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </section>
  );
}
