import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { connectToDatabase } from "@/lib/db/mongodb";
import { LeadModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";
import { requireRoleAccess } from "@/lib/auth/role-access";

export const dynamic = "force-dynamic";

function priorityVariant(priorityBand: string): "danger" | "warning" | "accent" | "neutral" {
  if (priorityBand === "heavy_artillery") return "danger";
  if (priorityBand === "standard_sales") return "warning";
  if (priorityBand === "volume_pipeline") return "accent";
  return "neutral";
}

type Params = Promise<{ id: string }>;

export default async function LeadDetailPage({ params }: { params: Params }) {
  await requireRoleAccess(["admin", "sales"]);

  const { id } = await params;
  await connectToDatabase();

  const leadDoc = await LeadModel.findById(id)
    .select(
      "title contactName email phone source category urgency score priorityBand priorityFlag status description budget",
    )
    .lean();

  if (!leadDoc) {
    notFound();
  }

  const lead = serializeForJson(leadDoc) as {
    _id: string;
    title: string;
    contactName: string;
    email: string;
    phone?: string;
    source: string;
    category: string;
    urgency: string;
    score: number;
    priorityBand: string;
    priorityFlag: boolean;
    status: string;
    description: string;
    budget?: { min: number; max: number; currency: string };
  };

  return (
    <section className="space-y-6">
      <DashboardHeader title={lead.title} subtitle="Lead details and current status." />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Lead Profile</CardTitle>
            <CardDescription>{lead.contactName}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <span className="text-muted-foreground">Email:</span> {lead.email}
            </p>
            {lead.phone ? (
              <p>
                <span className="text-muted-foreground">Phone:</span> {lead.phone}
              </p>
            ) : null}
            <p>
              <span className="text-muted-foreground">Source:</span> {" "}
              {lead.source.replaceAll("_", " ")}
            </p>
            <p>
              <span className="text-muted-foreground">Category:</span> {" "}
              {lead.category.replaceAll("_", " ")}
            </p>
            <p>
              <span className="text-muted-foreground">Urgency:</span> {lead.urgency}
            </p>
            <p>
              <span className="text-muted-foreground">Status:</span> {" "}
              {lead.status.replaceAll("_", " ")}
            </p>
            <p>
              <span className="text-muted-foreground">Description:</span> {lead.description}
            </p>
            {lead.budget ? (
              <p>
                <span className="text-muted-foreground">Budget:</span> {lead.budget.currency}{" "}
                {lead.budget.min.toLocaleString()} - {lead.budget.max.toLocaleString()}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lead Score</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-semibold">{lead.score ?? 0}</p>
            <Badge variant={priorityVariant(lead.priorityBand)}>
              {lead.priorityBand.replaceAll("_", " ")}
            </Badge>
            <p className="text-sm text-muted-foreground">
              {lead.priorityFlag
                ? "High-priority lead."
                : "Standard pipeline lead."}
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
