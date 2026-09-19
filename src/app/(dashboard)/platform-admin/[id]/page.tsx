import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrganizationPlanForm } from "@/components/platformAdmin/organization-plan-form";
import { ProvisionIndustryPackForm } from "@/components/platformAdmin/provision-industry-pack-form";
import { requireRoleAccess } from "@/lib/auth/role-access";
import {
  fetchDashboardIndustryPacks,
  fetchDashboardOrganizationDetail,
  DashboardApiError,
} from "@/lib/platformAdmin/dashboardClient";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function PlatformAdminOrganizationPage({ params }: { params: Params }) {
  await requireRoleAccess(["admin"]);
  const { id } = await params;

  let detail: Awaited<ReturnType<typeof fetchDashboardOrganizationDetail>> | null = null;
  let loadError: string | null = null;

  try {
    detail = await fetchDashboardOrganizationDetail(id);
  } catch (error) {
    loadError =
      error instanceof DashboardApiError ? error.message : "Could not reach Dashboard-WhatsApp.";
  }

  const industryPacks = detail ? await fetchDashboardIndustryPacks().catch(() => []) : [];

  if (loadError || !detail) {
    return (
      <section className="space-y-6">
        <DashboardHeader title="Platform Admin" subtitle="Organization not found." />
        <p className="text-sm text-danger">{loadError ?? "Organization not found."}</p>
        <Link href="/platform-admin" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to organizations
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <Link
          href="/platform-admin"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All organizations
        </Link>
      </div>
      <DashboardHeader title={detail.organization.name} subtitle={detail.organization.slug} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Plan &amp; Billing</CardTitle>
          </CardHeader>
          <CardContent>
            <OrganizationPlanForm
              organizationId={detail.organization.id}
              currentPlan={detail.organization.plan}
              currentBillingStatus={detail.organization.billingStatus}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage this month ({detail.usage.period})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {detail.usage.metrics.map((metric) => (
              <div key={metric.metric} className="flex items-center justify-between rounded-lg border border-border bg-vega-surface-1 p-3">
                <div>
                  <p className="text-sm font-medium">{metric.metric}</p>
                  <p className="text-xs text-muted-foreground">
                    {metric.count}
                    {metric.limit != null ? ` / ${metric.limit}` : " (unmetered)"}
                  </p>
                </div>
                {metric.exceeded ? (
                  <Badge variant="danger">Over limit</Badge>
                ) : metric.softWarn ? (
                  <Badge variant="warning">Approaching limit</Badge>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Entitlements</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {detail.entitlements.capabilities.map((capability) => (
              <Badge key={capability.key} variant={capability.enabled ? "success" : "neutral"} title={capability.description}>
                {capability.label}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <p>Workspaces: {detail.workspaces.length}</p>
            <p>Members: {detail.members.length}</p>
            <p>Templates: {detail.summary.templates}</p>
            <p>Automation flows: {detail.summary.automationFlows}</p>
            <p>Campaigns: {detail.summary.campaigns}</p>
            <p>WhatsApp numbers: {detail.summary.whatsappAccounts}</p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Onboarding: activate an Industry Pack</CardTitle>
          </CardHeader>
          <CardContent>
            <ProvisionIndustryPackForm
              organizationId={detail.organization.id}
              workspaces={detail.workspaces.map((workspace) => ({ id: workspace.id, name: workspace.name }))}
              industryPacks={industryPacks}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>WhatsApp Numbers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {detail.whatsappAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No WhatsApp numbers connected yet.</p>
            ) : (
              detail.whatsappAccounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between rounded-lg border border-border bg-vega-surface-1 p-3 text-sm">
                  <div>
                    <p className="font-medium">{account.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {account.phoneNumber} {"•"} {account.workspace}
                    </p>
                  </div>
                  <Badge variant={account.status === "connected" ? "success" : "warning"}>{account.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
