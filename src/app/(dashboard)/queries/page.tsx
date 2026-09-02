import { DashboardHeader } from "@/components/dashboard/header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { getClientQueries } from "@/lib/dashboard/queries";

export const dynamic = "force-dynamic";

type QueryUser = {
  _id: string;
  fullName?: string;
  email?: string;
};

type ClientQuery = {
  _id: string;
  projectName: string;
  subject: string;
  message: string;
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "resolved";
  raisedBy?: QueryUser | string | null;
  createdAt: string;
  updatedAt: string;
};

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getClientLabel(value: ClientQuery["raisedBy"]) {
  if (!value) return { name: "Client", email: "No email available" };
  if (typeof value === "string") return { name: "Client", email: value };
  return {
    name: value.fullName || value.email || "Client",
    email: value.email || "No email available",
  };
}

function statusVariant(status: ClientQuery["status"]) {
  if (status === "resolved") return "success" as const;
  if (status === "in_progress") return "warning" as const;
  return "accent" as const;
}

function priorityVariant(priority: ClientQuery["priority"]) {
  if (priority === "high") return "danger" as const;
  if (priority === "medium") return "warning" as const;
  return "neutral" as const;
}

export default async function QueriesPage() {
  await requireRoleAccess(["admin", "sales", "digital_marketing", "developer"]);

  const queries = (await getClientQueries({ limit: 300 })) as ClientQuery[];
  const stats = {
    total: queries.length,
    open: queries.filter((query) => query.status === "open").length,
    inProgress: queries.filter((query) => query.status === "in_progress").length,
    resolved: queries.filter((query) => query.status === "resolved").length,
    high: queries.filter((query) => query.priority === "high").length,
  };

  return (
    <section className="space-y-5">
      <DashboardHeader
        title="Client Queries"
        subtitle="Queries submitted from nemnidhi.com/portal/queries are collected here for staff review."
        showLeadCta={false}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Total", stats.total],
          ["Open", stats.open],
          ["In Progress", stats.inProgress],
          ["Resolved", stats.resolved],
          ["High Priority", stats.high],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent>
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Query Inbox</CardTitle>
          <CardDescription>Newest client submissions appear first.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {queries.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-surface-soft p-5 text-sm text-muted-foreground">
              No client queries have arrived yet.
            </div>
          ) : (
            queries.map((query) => {
              const client = getClientLabel(query.raisedBy);

              return (
                <article key={query._id} className="rounded-lg border border-border bg-surface-soft p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground">{query.subject}</h3>
                        <Badge variant={priorityVariant(query.priority)}>{humanize(query.priority)}</Badge>
                        <Badge variant={statusVariant(query.status)}>{humanize(query.status)}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {client.name} / {client.email}
                      </p>
                    </div>
                    <div className="shrink-0 text-left text-xs text-muted-foreground md:text-right">
                      <p>Raised {formatDateTime(query.createdAt)}</p>
                      <p className="mt-1">Updated {formatDateTime(query.updatedAt)}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-[220px_1fr]">
                    <div className="rounded-lg border border-border bg-vega-surface-1 p-3">
                      <p className="text-[11px] font-semibold uppercase text-muted-foreground">Workstream</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{query.projectName}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-vega-surface-1 p-3">
                      <p className="text-[11px] font-semibold uppercase text-muted-foreground">Message</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">{query.message}</p>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </CardContent>
      </Card>
    </section>
  );
}
