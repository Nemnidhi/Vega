import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getClients } from "@/lib/dashboard/queries";
import { requireRoleAccess } from "@/lib/auth/role-access";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  await requireRoleAccess(["admin", "sales"]);

  const clients = (await getClients()) as Array<{
    _id: string;
    legalName: string;
    primaryContactName: string;
    primaryContactEmail: string;
  }>;

  return (
    <section className="space-y-6">
      <DashboardHeader
        title="Clients"
        subtitle="Access client profiles and document vault views."
      />

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
                <p className="font-semibold">{client.legalName}</p>
                <p className="text-xs text-muted-foreground">
                  {client.primaryContactName} • {client.primaryContactEmail}
                </p>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}
