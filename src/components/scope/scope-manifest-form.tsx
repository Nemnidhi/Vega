"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ScopeData = {
  leadId: string;
  clientId: string;
  businessObjective: string;
  confirmedDeliverables: string;
  exclusions: string;
  clientResponsibilities: string;
  timelineAssumptions: string;
  paymentMilestones: string;
  revisionLimits: string;
  maintenanceTerms: string;
  changeOrderRules: string;
  isCompleted: boolean;
  signedAt: string;
};

function fromArray(input: unknown) {
  if (!Array.isArray(input)) return "";
  return input.join(", ");
}

function csvToArray(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ScopeManifestForm({
  leadId,
  initialData,
}: {
  leadId: string;
  initialData?: Record<string, unknown> | null;
}) {
  const [state, setState] = useState<ScopeData>({
    leadId,
    clientId: String(initialData?.clientId ?? ""),
    businessObjective: String(initialData?.businessObjective ?? ""),
    confirmedDeliverables: fromArray(initialData?.confirmedDeliverables),
    exclusions: fromArray(initialData?.exclusions),
    clientResponsibilities: fromArray(initialData?.clientResponsibilities),
    timelineAssumptions: fromArray(initialData?.timelineAssumptions),
    paymentMilestones: Array.isArray(initialData?.paymentMilestones)
      ? (initialData?.paymentMilestones as Array<{ heading: string; content: string }>)
          .map((item) => `${item.heading}: ${item.content}`)
          .join(" | ")
      : "",
    revisionLimits: String(initialData?.revisionLimits ?? ""),
    maintenanceTerms: String(initialData?.maintenanceTerms ?? ""),
    changeOrderRules: String(initialData?.changeOrderRules ?? ""),
    isCompleted: Boolean(initialData?.isCompleted ?? false),
    signedAt: initialData?.signedAt
      ? new Date(String(initialData.signedAt)).toISOString().slice(0, 10)
      : "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function saveManifest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const paymentMilestones = state.paymentMilestones
        .split("|")
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .map((chunk) => {
          const [heading, ...rest] = chunk.split(":");
          return {
            heading: heading?.trim() || "Milestone",
            content: rest.join(":").trim() || "Details pending",
          };
        });

      const response = await fetch(`/api/scope/${leadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          clientId: state.clientId,
          businessObjective: state.businessObjective,
          confirmedDeliverables: csvToArray(state.confirmedDeliverables),
          exclusions: csvToArray(state.exclusions),
          clientResponsibilities: csvToArray(state.clientResponsibilities),
          timelineAssumptions: csvToArray(state.timelineAssumptions),
          paymentMilestones,
          revisionLimits: state.revisionLimits,
          maintenanceTerms: state.maintenanceTerms,
          changeOrderRules: state.changeOrderRules,
          isCompleted: state.isCompleted,
          signedAt: state.signedAt ? new Date(state.signedAt).toISOString() : null,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Failed to save scope manifest");
      }

      setMessage("Scope manifest saved.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save scope manifest");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scope-Lock Vault</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3" onSubmit={saveManifest}>
          <Input
            placeholder="Client ID"
            value={state.clientId}
            onChange={(event) => setState((prev) => ({ ...prev, clientId: event.target.value }))}
            required
          />
          <Textarea
            placeholder="Business objective"
            value={state.businessObjective}
            onChange={(event) =>
              setState((prev) => ({ ...prev, businessObjective: event.target.value }))
            }
            required
          />
          <Textarea
            placeholder="Confirmed deliverables (comma separated)"
            value={state.confirmedDeliverables}
            onChange={(event) =>
              setState((prev) => ({ ...prev, confirmedDeliverables: event.target.value }))
            }
            required
          />
          <Textarea
            placeholder="Exclusions (comma separated)"
            value={state.exclusions}
            onChange={(event) => setState((prev) => ({ ...prev, exclusions: event.target.value }))}
            required
          />
          <Textarea
            placeholder="Client responsibilities (comma separated)"
            value={state.clientResponsibilities}
            onChange={(event) =>
              setState((prev) => ({ ...prev, clientResponsibilities: event.target.value }))
            }
            required
          />
          <Textarea
            placeholder="Timeline assumptions (comma separated)"
            value={state.timelineAssumptions}
            onChange={(event) =>
              setState((prev) => ({ ...prev, timelineAssumptions: event.target.value }))
            }
            required
          />
          <Textarea
            placeholder="Payment milestones (format: Milestone: Details | Milestone: Details)"
            value={state.paymentMilestones}
            onChange={(event) =>
              setState((prev) => ({ ...prev, paymentMilestones: event.target.value }))
            }
            required
          />
          <Textarea
            placeholder="Revision limits"
            value={state.revisionLimits}
            onChange={(event) =>
              setState((prev) => ({ ...prev, revisionLimits: event.target.value }))
            }
            required
          />
          <Textarea
            placeholder="Maintenance terms"
            value={state.maintenanceTerms}
            onChange={(event) =>
              setState((prev) => ({ ...prev, maintenanceTerms: event.target.value }))
            }
            required
          />
          <Textarea
            placeholder="Change order rules"
            value={state.changeOrderRules}
            onChange={(event) =>
              setState((prev) => ({ ...prev, changeOrderRules: event.target.value }))
            }
            required
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={state.isCompleted}
                onChange={(event) =>
                  setState((prev) => ({ ...prev, isCompleted: event.target.checked }))
                }
              />
              Mark as complete
            </label>
            <Input
              type="date"
              value={state.signedAt}
              onChange={(event) => setState((prev) => ({ ...prev, signedAt: event.target.value }))}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Scope Manifest"}
            </Button>
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
