import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/header";
import { LeadIntakeForms } from "@/components/leads/lead-intake-forms";
import { LeadStatusSelect } from "@/components/leads/lead-status-select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLeads } from "@/lib/dashboard/queries";

export const dynamic = "force-dynamic";

function priorityVariant(priorityBand: string): "danger" | "warning" | "accent" | "neutral" {
  if (priorityBand === "heavy_artillery") return "danger";
  if (priorityBand === "standard_sales") return "warning";
  if (priorityBand === "volume_pipeline") return "accent";
  return "neutral";
}

export default async function LeadsPage() {
  const leads = (await getLeads()) as Array<{
    _id: string;
    title: string;
    contactName: string;
    email: string;
    status: string;
    category: string;
    score: number;
    priorityBand: string;
  }>;

  return (
    <section className="space-y-6">
      <DashboardHeader
        title="Lead Command"
        subtitle="Capture, qualify, score, and route high-intent mandates."
      />

      <LeadIntakeForms />

      <Card>
        <CardHeader>
          <CardTitle>CRM Lead List</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-2 py-2">Lead</th>
                <th className="px-2 py-2">Category</th>
                <th className="px-2 py-2">Score</th>
                <th className="px-2 py-2">Priority</th>
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
                  <td className="px-2 py-3">{lead.category.replaceAll("_", " ")}</td>
                  <td className="px-2 py-3 font-mono">{lead.score ?? 0}</td>
                  <td className="px-2 py-3">
                    <Badge variant={priorityVariant(lead.priorityBand)}>
                      {lead.priorityBand.replaceAll("_", " ")}
                    </Badge>
                  </td>
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
                  <td colSpan={6} className="px-2 py-6 text-center text-muted-foreground">
                    No leads yet. Use intake forms above to create first lead.
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
