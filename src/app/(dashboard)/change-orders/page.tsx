import { ChangeOrderForm } from "@/components/change-orders/change-order-form";
import { DashboardHeader } from "@/components/dashboard/header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getChangeOrders } from "@/lib/dashboard/queries";

export const dynamic = "force-dynamic";

function formatCurrency(amount: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function approvalVariant(value: string): "success" | "warning" | "danger" | "neutral" {
  if (value === "approved") return "success";
  if (value === "pending") return "warning";
  if (value === "rejected") return "danger";
  return "neutral";
}

export default async function ChangeOrdersPage() {
  const changeOrders = (await getChangeOrders()) as Array<{
    _id: string;
    requestedFeature: string;
    additionalPrice: number;
    currency: string;
    timelineImpactDays: number;
    approvalStatus: string;
    leadId?: { title?: string };
  }>;

  return (
    <section className="space-y-6">
      <DashboardHeader
        title="Change Order Protection"
        subtitle="Every out-of-scope request after Closed Won is converted into a monetized change order."
      />

      <ChangeOrderForm />

      <Card>
        <CardHeader>
          <CardTitle>Change Order Register</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {changeOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No change orders created yet.</p>
          ) : (
            changeOrders.map((item) => (
              <div
                key={item._id}
                className="grid gap-2 rounded-lg border border-border bg-white p-3 sm:grid-cols-[2fr_1fr_1fr]"
              >
                <div>
                  <p className="font-semibold">{item.requestedFeature}</p>
                  <p className="text-xs text-muted-foreground">
                    Lead: {item.leadId?.title ?? "Unknown lead"}
                  </p>
                </div>
                <div className="text-sm">
                  <p>{formatCurrency(item.additionalPrice, item.currency)}</p>
                  <p className="text-xs text-muted-foreground">
                    +{item.timelineImpactDays} days
                  </p>
                </div>
                <div className="flex items-center justify-end">
                  <Badge variant={approvalVariant(item.approvalStatus)}>
                    {item.approvalStatus}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}
