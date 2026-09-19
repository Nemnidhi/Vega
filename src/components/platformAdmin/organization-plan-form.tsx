"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const PLAN_OPTIONS = ["basic", "medium", "pro", "custom"] as const;
const BILLING_STATUS_OPTIONS = [
  "trial",
  "active",
  "pending",
  "cancelling",
  "past_due",
  "suspended",
  "halted",
  "cancelled",
] as const;

export function OrganizationPlanForm({
  organizationId,
  currentPlan,
  currentBillingStatus,
}: {
  organizationId: string;
  currentPlan: string;
  currentBillingStatus: string;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState(currentPlan);
  const [billingStatus, setBillingStatus] = useState(currentBillingStatus);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const dirty = plan !== currentPlan || billingStatus !== currentBillingStatus;

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/platform-admin/organizations/${organizationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billingStatus }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload?.error?.message || "Could not update the organization.");
      }
      setMessage("Saved.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update the organization.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Plan</span>
          <select
            className="h-11 w-full rounded-lg border border-border bg-vega-surface-1 px-3 text-sm"
            value={plan}
            onChange={(event) => setPlan(event.target.value)}
          >
            {PLAN_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Billing status</span>
          <select
            className="h-11 w-full rounded-lg border border-border bg-vega-surface-1 px-3 text-sm"
            value={billingStatus}
            onChange={(event) => setBillingStatus(event.target.value)}
          >
            {BILLING_STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={!dirty || saving}>
          {saving ? "Saving..." : "Save changes"}
        </Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </div>
  );
}
