"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ProposalForm = {
  leadId: string;
  clientId: string;
  scopeManifestId: string;
  projectSummary: string;
  scopeOfWork: string;
  exclusions: string;
  timeline: string;
  pricing: string;
  paymentSchedule: string;
  changeOrderClause: string;
  signatureBlock: string;
};

const initialForm: ProposalForm = {
  leadId: "",
  clientId: "",
  scopeManifestId: "",
  projectSummary: "",
  scopeOfWork: "",
  exclusions: "",
  timeline: "",
  pricing: "",
  paymentSchedule: "",
  changeOrderClause:
    "Any requirement outside approved Deliverable Manifest will be handled via Change Order.",
  signatureBlock: "Authorized Signatory",
};

function csvToArray(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ProposalGeneratorForm() {
  const [form, setForm] = useState<ProposalForm>(initialForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submitProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const pricingLines = form.pricing
        .split("|")
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .map((chunk) => {
          const [label, amount, quantity] = chunk.split(":");
          return {
            label: label?.trim() || "Component",
            amount: Number(amount || 0),
            quantity: Number(quantity || 1),
            currency: "INR" as const,
          };
        });

      const paymentSchedule = form.paymentSchedule
        .split("|")
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .map((chunk) => {
          const [label, amount] = chunk.split(":");
          return {
            label: label?.trim() || "Milestone",
            amount: Number(amount || 0),
            currency: "INR" as const,
          };
        });

      const response = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: form.leadId,
          clientId: form.clientId,
          scopeManifestId: form.scopeManifestId,
          projectSummary: form.projectSummary,
          scopeOfWork: csvToArray(form.scopeOfWork),
          exclusions: csvToArray(form.exclusions),
          timeline: form.timeline,
          milestones: paymentSchedule,
          pricing: pricingLines,
          paymentSchedule,
          changeOrderClause: form.changeOrderClause,
          signatureBlock: form.signatureBlock,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Failed to generate proposal");
      }

      setMessage("Proposal generated and stored.");
      setForm(initialForm);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to generate proposal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mandate Engine — Proposal Generator</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3" onSubmit={submitProposal}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              placeholder="Lead ID"
              value={form.leadId}
              onChange={(event) => setForm((prev) => ({ ...prev, leadId: event.target.value }))}
              required
            />
            <Input
              placeholder="Client ID"
              value={form.clientId}
              onChange={(event) => setForm((prev) => ({ ...prev, clientId: event.target.value }))}
              required
            />
            <Input
              placeholder="Scope Manifest ID"
              value={form.scopeManifestId}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, scopeManifestId: event.target.value }))
              }
              required
            />
          </div>
          <Textarea
            placeholder="Project summary"
            value={form.projectSummary}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, projectSummary: event.target.value }))
            }
            required
          />
          <Textarea
            placeholder="Scope of work (comma separated)"
            value={form.scopeOfWork}
            onChange={(event) => setForm((prev) => ({ ...prev, scopeOfWork: event.target.value }))}
            required
          />
          <Textarea
            placeholder="Exclusions (comma separated)"
            value={form.exclusions}
            onChange={(event) => setForm((prev) => ({ ...prev, exclusions: event.target.value }))}
            required
          />
          <Input
            placeholder="Timeline"
            value={form.timeline}
            onChange={(event) => setForm((prev) => ({ ...prev, timeline: event.target.value }))}
            required
          />
          <Textarea
            placeholder="Pricing lines (format: Label:Amount:Qty | Label:Amount:Qty)"
            value={form.pricing}
            onChange={(event) => setForm((prev) => ({ ...prev, pricing: event.target.value }))}
            required
          />
          <Textarea
            placeholder="Payment schedule (format: Milestone:Amount | Milestone:Amount)"
            value={form.paymentSchedule}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, paymentSchedule: event.target.value }))
            }
            required
          />
          <Textarea
            placeholder="Change order clause"
            value={form.changeOrderClause}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, changeOrderClause: event.target.value }))
            }
            required
          />
          <Input
            placeholder="Signature block"
            value={form.signatureBlock}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, signatureBlock: event.target.value }))
            }
            required
          />
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? "Generating..." : "Generate Proposal"}
            </Button>
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
