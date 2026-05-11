"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type LeadSource =
  | "website"
  | "referral"
  | "cold_outreach"
  | "paid_ads"
  | "event"
  | "partner"
  | "other";

type LeadCategory =
  | "software_request"
  | "infrastructure"
  | "legal_automation"
  | "retainer_enterprise"
  | "other";

type LeadUrgency = "low" | "medium" | "high" | "critical";

type LeadFormState = {
  title: string;
  contactName: string;
  email: string;
  phone: string;
  source: LeadSource;
  category: LeadCategory;
  urgency: LeadUrgency;
  description: string;
  budgetMin: string;
  budgetMax: string;
  budgetCurrency: "INR" | "USD";
  sourceDomain: string;
  sourcePath: string;
  sourceReferrer: string;
  tagsText: string;
};

type LeadEditorPayload = {
  id: string;
  title: string;
  contactName: string;
  email: string;
  phone?: string;
  source: string;
  category: string;
  urgency: string;
  description: string;
  budget?: { min: number; max: number; currency: string };
  sourceDomain?: string;
  sourcePath?: string;
  sourceReferrer?: string;
  tags?: string[];
};

const sourceOptions: Array<{ value: LeadSource; label: string }> = [
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "cold_outreach", label: "Cold Outreach" },
  { value: "paid_ads", label: "Paid Ads" },
  { value: "event", label: "Event" },
  { value: "partner", label: "Partner" },
  { value: "other", label: "Other" },
];

const categoryOptions: Array<{ value: LeadCategory; label: string }> = [
  { value: "software_request", label: "Software Request" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "legal_automation", label: "Legal Automation" },
  { value: "retainer_enterprise", label: "Retainer Enterprise" },
  { value: "other", label: "Other" },
];

const urgencyOptions: Array<{ value: LeadUrgency; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

function toLeadSource(value: string): LeadSource {
  const allowed = new Set<LeadSource>([
    "website",
    "referral",
    "cold_outreach",
    "paid_ads",
    "event",
    "partner",
    "other",
  ]);
  return allowed.has(value as LeadSource) ? (value as LeadSource) : "website";
}

function toLeadCategory(value: string): LeadCategory {
  const allowed = new Set<LeadCategory>([
    "software_request",
    "infrastructure",
    "legal_automation",
    "retainer_enterprise",
    "other",
  ]);
  return allowed.has(value as LeadCategory) ? (value as LeadCategory) : "software_request";
}

function toLeadUrgency(value: string): LeadUrgency {
  const allowed = new Set<LeadUrgency>(["low", "medium", "high", "critical"]);
  return allowed.has(value as LeadUrgency) ? (value as LeadUrgency) : "medium";
}

function toCurrency(value?: string): "INR" | "USD" {
  return value === "USD" ? "USD" : "INR";
}

function parseTags(input: string) {
  return Array.from(
    new Set(
      input
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.slice(0, 40)),
    ),
  ).slice(0, 20);
}

export function LeadFieldsEditor({ lead }: { lead: LeadEditorPayload }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const initialState = useMemo<LeadFormState>(
    () => ({
      title: lead.title,
      contactName: lead.contactName,
      email: lead.email,
      phone: lead.phone ?? "",
      source: toLeadSource(lead.source),
      category: toLeadCategory(lead.category),
      urgency: toLeadUrgency(lead.urgency),
      description: lead.description,
      budgetMin: lead.budget?.min !== undefined ? String(lead.budget.min) : "",
      budgetMax: lead.budget?.max !== undefined ? String(lead.budget.max) : "",
      budgetCurrency: toCurrency(lead.budget?.currency),
      sourceDomain: lead.sourceDomain ?? "",
      sourcePath: lead.sourcePath ?? "",
      sourceReferrer: lead.sourceReferrer ?? "",
      tagsText: (lead.tags ?? []).join(", "),
    }),
    [lead],
  );
  const [form, setForm] = useState<LeadFormState>(initialState);

  const canSubmit =
    form.title.trim().length >= 3 &&
    form.contactName.trim().length >= 2 &&
    form.email.trim().includes("@") &&
    form.description.trim().length >= 10;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const budgetMin = form.budgetMin.trim();
      const budgetMax = form.budgetMax.trim();
      let budget: { min: number; max: number; currency: "INR" | "USD" } | undefined;

      if (budgetMin || budgetMax) {
        const parsedMin = Number(budgetMin || budgetMax);
        const parsedMax = Number(budgetMax || budgetMin);
        if (!Number.isFinite(parsedMin) || !Number.isFinite(parsedMax)) {
          throw new Error("Budget min and max must be numeric values.");
        }
        if (parsedMax < parsedMin) {
          throw new Error("Budget max must be greater than or equal to budget min.");
        }
        budget = {
          min: parsedMin,
          max: parsedMax,
          currency: form.budgetCurrency,
        };
      }

      const response = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          contactName: form.contactName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim() || undefined,
          source: form.source,
          category: form.category,
          urgency: form.urgency,
          description: form.description.trim(),
          budget,
          sourceDomain: form.sourceDomain.trim() || undefined,
          sourcePath: form.sourcePath.trim() || undefined,
          sourceReferrer: form.sourceReferrer.trim() || undefined,
          tags: parseTags(form.tagsText),
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Lead update failed");
      }

      setMessage("Lead fields updated.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Lead update failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <Input
        value={form.title}
        onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
        placeholder="Lead title"
        required
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          value={form.contactName}
          onChange={(event) => setForm((prev) => ({ ...prev, contactName: event.target.value }))}
          placeholder="Contact name"
          required
        />
        <Input
          type="email"
          value={form.email}
          onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          placeholder="Email"
          required
        />
      </div>

      <Input
        value={form.phone}
        onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
        placeholder="Phone"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <select
          className="h-11 rounded-lg border border-border bg-white px-3 text-sm"
          value={form.source}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              source: event.target.value as LeadSource,
            }))
          }
        >
          {sourceOptions.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        <select
          className="h-11 rounded-lg border border-border bg-white px-3 text-sm"
          value={form.category}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              category: event.target.value as LeadCategory,
            }))
          }
        >
          {categoryOptions.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        <select
          className="h-11 rounded-lg border border-border bg-white px-3 text-sm"
          value={form.urgency}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              urgency: event.target.value as LeadUrgency,
            }))
          }
        >
          {urgencyOptions.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          type="number"
          min={0}
          value={form.budgetMin}
          onChange={(event) => setForm((prev) => ({ ...prev, budgetMin: event.target.value }))}
          placeholder="Budget Min"
        />
        <Input
          type="number"
          min={0}
          value={form.budgetMax}
          onChange={(event) => setForm((prev) => ({ ...prev, budgetMax: event.target.value }))}
          placeholder="Budget Max"
        />
        <select
          className="h-11 rounded-lg border border-border bg-white px-3 text-sm"
          value={form.budgetCurrency}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              budgetCurrency: event.target.value as "INR" | "USD",
            }))
          }
        >
          <option value="INR">INR</option>
          <option value="USD">USD</option>
        </select>
      </div>

      <Textarea
        value={form.description}
        onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
        placeholder="Requirement summary"
        required
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          value={form.sourceDomain}
          onChange={(event) => setForm((prev) => ({ ...prev, sourceDomain: event.target.value }))}
          placeholder="Source domain (optional)"
        />
        <Input
          value={form.sourcePath}
          onChange={(event) => setForm((prev) => ({ ...prev, sourcePath: event.target.value }))}
          placeholder="Source path (optional)"
        />
      </div>

      <Input
        value={form.sourceReferrer}
        onChange={(event) =>
          setForm((prev) => ({ ...prev, sourceReferrer: event.target.value }))
        }
        placeholder="Source referrer (optional)"
      />

      <Input
        value={form.tagsText}
        onChange={(event) => setForm((prev) => ({ ...prev, tagsText: event.target.value }))}
        placeholder="Tags (comma separated)"
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!canSubmit || loading}>
          {loading ? "Saving..." : "Save Lead Fields"}
        </Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </form>
  );
}
