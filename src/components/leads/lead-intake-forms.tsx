"use client";

import { type FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type IntakeType =
  | "software_request"
  | "infrastructure"
  | "legal_automation"
  | "retainer_enterprise";

const intakeCatalog: Record<
  IntakeType,
  { title: string; hint: string; defaultTitle: string }
> = {
  software_request: {
    title: "Basic software request",
    hint: "Ideal for product MVP, workflow tools, and web applications.",
    defaultTitle: "Custom software request",
  },
  infrastructure: {
    title: "High-ticket infrastructure request",
    hint: "For architecture modernization, cloud migration, and scalability work.",
    defaultTitle: "Infrastructure modernization request",
  },
  legal_automation: {
    title: "Legal-tech automation request",
    hint: "For legal workflow automation, drafting engines, and case systems.",
    defaultTitle: "Legal automation request",
  },
  retainer_enterprise: {
    title: "Retainer / enterprise request",
    hint: "For strategic long-term delivery and enterprise advisory mandates.",
    defaultTitle: "Enterprise retainer request",
  },
};

type LeadFormState = {
  title: string;
  contactName: string;
  email: string;
  phone: string;
  source: "website" | "referral" | "cold_outreach" | "paid_ads" | "event" | "partner" | "other";
  urgency: "low" | "medium" | "high" | "critical";
  budgetMin: string;
  budgetMax: string;
  description: string;
  tags: string;
};

const initialState: LeadFormState = {
  title: intakeCatalog.software_request.defaultTitle,
  contactName: "",
  email: "",
  phone: "",
  source: "website",
  urgency: "medium",
  budgetMin: "",
  budgetMax: "",
  description: "",
  tags: "",
};

export function LeadIntakeForms() {
  const [intakeType, setIntakeType] = useState<IntakeType>("software_request");
  const [form, setForm] = useState<LeadFormState>(initialState);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const selectedType = intakeCatalog[intakeType];

  const canSubmit = useMemo(
    () =>
      form.contactName.trim().length >= 2 &&
      form.email.trim().includes("@") &&
      form.description.trim().length >= 10,
    [form.contactName, form.description, form.email],
  );

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const budgetMin = Number(form.budgetMin);
      const budgetMax = Number(form.budgetMax);
      const hasBudget = Number.isFinite(budgetMin) && Number.isFinite(budgetMax);

      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          contactName: form.contactName,
          email: form.email,
          phone: form.phone || undefined,
          source: form.source,
          category: intakeType,
          urgency: form.urgency,
          budget: hasBudget
            ? { min: budgetMin, max: budgetMax, currency: "INR" }
            : undefined,
          description: form.description,
          tags: form.tags
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Lead creation failed");
      }

      setMessage("Lead captured and scored successfully.");
      setForm({
        ...initialState,
        title: selectedType.defaultTitle,
      });
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
        <CardTitle>Lead Capture — The Intent Harvesters</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">{selectedType.hint}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(intakeCatalog).map(([key, item]) => (
            <button
              key={key}
              type="button"
              className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                intakeType === key
                  ? "border-accent bg-accent-soft text-accent-strong"
                  : "border-border bg-surface hover:bg-surface-soft"
              }`}
              onClick={() => {
                const nextType = key as IntakeType;
                setIntakeType(nextType);
                setForm((prev) => ({
                  ...prev,
                  title: intakeCatalog[nextType].defaultTitle,
                }));
              }}
            >
              <p className="font-semibold">{item.title}</p>
            </button>
          ))}
        </div>

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
            <Input
              value={form.tags}
              onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
              placeholder="Tags: fintech, litigation, etc"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
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
            <Input
              value={form.budgetMin}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, budgetMin: event.target.value }))
              }
              placeholder="Budget min"
              type="number"
            />
          </div>
          <Input
            value={form.budgetMax}
            onChange={(event) => setForm((prev) => ({ ...prev, budgetMax: event.target.value }))}
            placeholder="Budget max"
            type="number"
          />
          <Textarea
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, description: event.target.value }))
            }
            placeholder="Describe requirements, context, outcomes, constraints..."
            required
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={!canSubmit || loading}>
              {loading ? "Capturing..." : "Capture Lead"}
            </Button>
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
