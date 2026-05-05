"use client";

import { type FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type LeadCategory = "software_request" | "infrastructure" | "other";

type LeadFormState = {
  title: string;
  contactName: string;
  email: string;
  phone: string;
  category: LeadCategory;
  source: "website" | "referral" | "cold_outreach" | "paid_ads" | "event" | "partner" | "other";
  urgency: "low" | "medium" | "high" | "critical";
  description: string;
};

const initialState: LeadFormState = {
  title: "",
  contactName: "",
  email: "",
  phone: "",
  category: "software_request",
  source: "website",
  urgency: "medium",
  description: "",
};

export function LeadIntakeForms() {
  const [form, setForm] = useState<LeadFormState>(initialState);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");

  const canSubmit = useMemo(
    () =>
      form.title.trim().length >= 3 &&
      form.contactName.trim().length >= 2 &&
      form.email.trim().includes("@") &&
      form.description.trim().length >= 10,
    [form.contactName, form.description, form.email, form.title],
  );

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          contactName: form.contactName,
          email: form.email,
          phone: form.phone || undefined,
          category: form.category,
          source: form.source,
          urgency: form.urgency,
          description: form.description,
          tags: [],
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Lead creation failed");
      }

      setMessage("Lead saved successfully.");
      setForm(initialState);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create lead");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Lead</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Fill basic details to add a lead quickly.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <form className="grid gap-3" onSubmit={submitLead}>
          <Input
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Lead title"
            required
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={form.contactName}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, contactName: event.target.value }))
              }
              placeholder="Contact name"
              required
            />
            <Input
              value={form.email}
              type="email"
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="Contact email"
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              placeholder="Phone (optional)"
            />
            <select
              className="h-11 rounded-lg border border-border bg-white px-3 text-sm"
              value={form.category}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  category: event.target.value as LeadFormState["category"],
                }))
              }
            >
              <option value="software_request">Software Request</option>
              <option value="infrastructure">Infrastructure</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <select
              className="h-11 rounded-lg border border-border bg-white px-3 text-sm"
              value={form.source}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  source: event.target.value as LeadFormState["source"],
                }))
              }
            >
              <option value="website">Website</option>
              <option value="referral">Referral</option>
              <option value="cold_outreach">Cold outreach</option>
              <option value="paid_ads">Paid ads</option>
              <option value="event">Event</option>
              <option value="partner">Partner</option>
              <option value="other">Other</option>
            </select>

            <select
              className="h-11 rounded-lg border border-border bg-white px-3 text-sm"
              value={form.urgency}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  urgency: event.target.value as LeadFormState["urgency"],
                }))
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <Textarea
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, description: event.target.value }))
            }
            placeholder="Short requirement summary..."
            required
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={!canSubmit || loading}>
              {loading ? "Saving..." : "Save Lead"}
            </Button>
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
