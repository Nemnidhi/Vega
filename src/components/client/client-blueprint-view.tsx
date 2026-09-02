"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { BlueprintRecord } from "@/components/blueprint/blueprint-editor";

function formatMoney(value: number, currency: string) {
  return `${currency === "INR" ? "Rs. " : currency + " "}${value.toLocaleString("en-IN")}`;
}

export function ClientBlueprintView({
  leadId,
  initialBlueprint,
}: {
  leadId: string;
  initialBlueprint: BlueprintRecord | null;
}) {
  const [blueprint, setBlueprint] = useState<BlueprintRecord | null>(initialBlueprint);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<null | "approve" | "reject">(null);
  const [showReasonBox, setShowReasonBox] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function respond(decision: "approve" | "reject") {
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
      const res = await fetch(`/api/blueprint/${leadId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason: decision === "reject" ? reason : undefined }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body?.error?.message ?? "Could not send your response");
      }
      setBlueprint(body.data as BlueprintRecord);
      setMessage({
        kind: "ok",
        text:
          decision === "approve"
            ? "Approved - thank you. Our team will follow up on next steps."
            : "Sent - our team will revise this and share an updated version.",
      });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Request failed" });
    } finally {
      setBusy(null);
    }
  }

  if (!blueprint) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Requirements & Estimate</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nothing has been shared with you yet - this will show up here once our team has put
            together a system overview from your requirements call.
          </p>
        </CardContent>
      </Card>
    );
  }

  const canRespond = blueprint.status === "shared";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Requirements & Estimate</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Badge
          variant={
            blueprint.status === "approved"
              ? "success"
              : blueprint.status === "rejected"
                ? "danger"
                : "accent"
          }
        >
          {blueprint.status}
        </Badge>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-vega-surface-1 p-3">
            <p className="text-xs text-muted-foreground">One-time</p>
            <p className="mt-1 font-semibold text-foreground">
              {formatMoney(blueprint.estimate.oneTimeMin, blueprint.estimate.currency)} -{" "}
              {formatMoney(blueprint.estimate.oneTimeMax, blueprint.estimate.currency)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-vega-surface-1 p-3">
            <p className="text-xs text-muted-foreground">Monthly</p>
            <p className="mt-1 font-semibold text-foreground">
              {formatMoney(blueprint.estimate.monthlyMin, blueprint.estimate.currency)} -{" "}
              {formatMoney(blueprint.estimate.monthlyMax, blueprint.estimate.currency)}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {blueprint.components.map((c) => (
            <div key={c.code} className="rounded-lg border border-border bg-vega-surface-1 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-foreground">{c.title}</span>
                <span className="text-sm text-muted-foreground">
                  {formatMoney(c.oneTimePrice, blueprint.estimate.currency)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{c.rationale}</p>
            </div>
          ))}
        </div>

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
              <Button type="button" onClick={() => respond("approve")} disabled={busy !== null}>
                {busy === "approve" ? "Approving..." : "Approve"}
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

        {message ? (
          <p className={`text-sm ${message.kind === "ok" ? "text-success" : "text-danger"}`}>
            {message.text}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
