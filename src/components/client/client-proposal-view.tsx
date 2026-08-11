"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type PricingLine = { label: string; amount: number; quantity: number; currency: "INR" | "USD" };
type PaymentLine = { label: string; amount: number; currency: "INR" | "USD" };

export type ClientProposalRecord = {
  _id: string;
  version: number;
  status: "draft" | "generated" | "sent" | "viewed" | "signed" | "rejected";
  projectSummary: string;
  scopeOfWork: string[];
  exclusions: string[];
  timeline: string;
  pricing: PricingLine[];
  paymentSchedule: PaymentLine[];
  rejectionReason?: string | null;
  signedByName?: string | null;
};

function formatMoney(value: number, currency: "INR" | "USD") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function ClientProposalView({
  initialProposal,
}: {
  initialProposal: ClientProposalRecord | null;
}) {
  const [proposal, setProposal] = useState<ClientProposalRecord | null>(initialProposal);
  const [reason, setReason] = useState("");
  const [showReasonBox, setShowReasonBox] = useState(false);
  const [busy, setBusy] = useState<null | "sign" | "reject">(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function respond(decision: "sign" | "reject") {
    if (!proposal) return;
    if (decision === "reject" && !showReasonBox) {
      setShowReasonBox(true);
      return;
    }
    if (decision === "reject" && reason.trim().length < 5) {
      setMessage({ kind: "error", text: "Add a bit more detail on what you'd like changed." });
      return;
    }

    setBusy(decision);
    setMessage(null);
    try {
      const res = await fetch(`/api/proposals/${proposal._id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason: decision === "reject" ? reason : undefined }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body?.error?.message ?? "Could not send your response");
      }
      setProposal(body.data as ClientProposalRecord);
      setMessage({
        kind: "ok",
        text:
          decision === "sign"
            ? "Signed - thank you. Our team will be in touch on next steps."
            : "Sent - our team will follow up on the changes you asked for.",
      });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Request failed" });
    } finally {
      setBusy(null);
    }
  }

  if (!proposal || !["sent", "viewed", "signed", "rejected"].includes(proposal.status)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Proposal</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nothing has been sent to you yet - your formal proposal will show up here once it&apos;s ready.
          </p>
        </CardContent>
      </Card>
    );
  }

  const canRespond = proposal.status === "sent" || proposal.status === "viewed";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Proposal</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Badge
          variant={
            proposal.status === "signed" ? "success" : proposal.status === "rejected" ? "danger" : "accent"
          }
        >
          {proposal.status}
        </Badge>

        <p className="text-sm text-foreground">{proposal.projectSummary}</p>

        <div>
          <p className="text-xs font-semibold text-muted-foreground">Scope of Work</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
            {proposal.scopeOfWork.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          {proposal.pricing.map((line) => (
            <div
              key={line.label}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white p-3"
            >
              <span className="text-foreground">{line.label}</span>
              <span className="text-sm text-muted-foreground">
                {formatMoney(line.amount * line.quantity, line.currency)}
              </span>
            </div>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">{proposal.timeline}</p>

        <a
          href={`/api/proposals/${proposal._id}/pdf`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-white px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-soft"
        >
          View Full Proposal
        </a>

        {canRespond ? (
          <div className="space-y-3 border-t border-border pt-4">
            {showReasonBox ? (
              <Textarea
                placeholder="What would you like changed?"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => respond("sign")} disabled={busy !== null}>
                {busy === "sign" ? "Signing..." : "Sign"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => respond("reject")}
                disabled={busy !== null}
              >
                {busy === "reject" ? "Sending..." : "Request Changes"}
              </Button>
            </div>
          </div>
        ) : null}

        {proposal.status === "rejected" && proposal.rejectionReason ? (
          <p className="text-sm text-muted-foreground">Your feedback: {proposal.rejectionReason}</p>
        ) : null}
        {proposal.status === "signed" && proposal.signedByName ? (
          <p className="text-sm text-muted-foreground">Signed by {proposal.signedByName}</p>
        ) : null}

        {message ? (
          <p className={`text-sm ${message.kind === "ok" ? "text-success" : "text-danger"}`}>
            {message.text}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
