"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ChangeOrderFormState = {
  leadId: string;
  clientId: string;
  proposalId: string;
  scopeManifestId: string;
  requestedFeature: string;
  reasonOutOfScope: string;
  additionalPrice: string;
  timelineImpactDays: string;
};

const initialState: ChangeOrderFormState = {
  leadId: "",
  clientId: "",
  proposalId: "",
  scopeManifestId: "",
  requestedFeature: "",
  reasonOutOfScope: "",
  additionalPrice: "0",
  timelineImpactDays: "0",
};

export function ChangeOrderForm() {
  const [form, setForm] = useState<ChangeOrderFormState>(initialState);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submitChangeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/change-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          additionalPrice: Number(form.additionalPrice),
          timelineImpactDays: Number(form.timelineImpactDays),
          currency: "INR",
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Failed to create change order");
      }

      setMessage("Change order created.");
      setForm(initialState);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create change order");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change Order Protection</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3" onSubmit={submitChangeOrder}>
          <div className="grid gap-3 sm:grid-cols-2">
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
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Proposal ID"
              value={form.proposalId}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, proposalId: event.target.value }))
              }
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
            placeholder="Requested feature"
            value={form.requestedFeature}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, requestedFeature: event.target.value }))
            }
            required
          />
          <Textarea
            placeholder="Reason out of scope"
            value={form.reasonOutOfScope}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, reasonOutOfScope: event.target.value }))
            }
            required
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              type="number"
              placeholder="Additional price"
              value={form.additionalPrice}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, additionalPrice: event.target.value }))
              }
              required
            />
            <Input
              type="number"
              placeholder="Timeline impact days"
              value={form.timelineImpactDays}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, timelineImpactDays: event.target.value }))
              }
              required
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Create Change Order"}
            </Button>
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
