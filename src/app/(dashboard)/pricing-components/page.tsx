import { DashboardHeader } from "@/components/dashboard/header";
import { PricingComponentForm } from "@/components/pricing/pricing-component-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPricingComponents } from "@/lib/dashboard/queries";

export const dynamic = "force-dynamic";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function PricingComponentsPage() {
  const components = (await getPricingComponents()) as Array<{
    _id: string;
    code: string;
    title: string;
    category: string;
    basePrice: number;
    complexityMultiplier: number;
    marginPercentage: number;
    finalPrice: number;
    isActive: boolean;
  }>;

  return (
    <section className="space-y-6">
      <DashboardHeader
        title="Dynamic Pricing Engine"
        subtitle="Margin-protected commercial components with complexity scaling."
      />

      <PricingComponentForm />

      <Card>
        <CardHeader>
          <CardTitle>Pricing Component Library</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {components.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No components available. Seed defaults or create manually.
            </p>
          ) : (
            components.map((component) => (
              <div
                key={component._id}
                className="grid gap-2 rounded-lg border border-border bg-white p-3 md:grid-cols-[1.4fr_1fr_1fr_1fr]"
              >
                <div>
                  <p className="font-semibold">{component.title}</p>
                  <p className="text-xs text-muted-foreground">{component.code}</p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {component.category} • x{component.complexityMultiplier}
                </div>
                <div className="text-sm">
                  <p>{formatCurrency(component.basePrice)}</p>
                  <p className="text-xs text-muted-foreground">
                    Margin {component.marginPercentage}%
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{formatCurrency(component.finalPrice)}</p>
                  <Badge variant={component.isActive ? "success" : "neutral"}>
                    {component.isActive ? "Active" : "Inactive"}
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
