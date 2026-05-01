import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getClientVault } from "@/lib/dashboard/queries";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function ClientVaultPage({ params }: { params: Params }) {
  const { id } = await params;
  const vault = await getClientVault(id);
  const data = vault as {
    client: { legalName: string; primaryContactName: string; primaryContactEmail: string } | null;
    proposals: Array<{ _id: string; status: string; approvalStatus: string }>;
    scopes: Array<{ _id: string; isCompleted: boolean; signedAt?: string | null }>;
    changeOrders: Array<{ _id: string; approvalStatus: string; requestedFeature: string }>;
  };

  if (!data.client) {
    notFound();
  }

  return (
    <section className="space-y-6">
      <DashboardHeader
        title={`${data.client.legalName} Vault`}
        subtitle="Approved document repository for client-facing visibility."
      />

      <Card>
        <CardHeader>
          <CardTitle>Client Identity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>{data.client.primaryContactName}</p>
          <p className="text-muted-foreground">{data.client.primaryContactEmail}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Proposals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.proposals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No proposals in vault.</p>
            ) : (
              data.proposals.map((item) => (
                <div key={item._id} className="rounded-lg border border-border bg-white p-2 text-sm">
                  <p className="font-mono text-xs">{item._id}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="neutral">{item.status}</Badge>
                    <Badge variant={item.approvalStatus === "approved" ? "success" : "warning"}>
                      {item.approvalStatus}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scope Manifests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.scopes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No scope manifests in vault.</p>
            ) : (
              data.scopes.map((item) => (
                <div key={item._id} className="rounded-lg border border-border bg-white p-2 text-sm">
                  <p className="font-mono text-xs">{item._id}</p>
                  <Badge variant={item.isCompleted ? "success" : "warning"}>
                    {item.isCompleted ? "Completed" : "Incomplete"}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change Orders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.changeOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No change orders in vault.</p>
            ) : (
              data.changeOrders.map((item) => (
                <div key={item._id} className="rounded-lg border border-border bg-white p-2 text-sm">
                  <p className="font-medium">{item.requestedFeature}</p>
                  <Badge variant={item.approvalStatus === "approved" ? "success" : "warning"}>
                    {item.approvalStatus}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
