"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ClientOnboardingFormState = {
  legalName: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  industry: string;
  companySize: string;
  preferredCommunication: "email" | "phone" | "whatsapp" | "slack" | "meetings";
  requirementSummary: string;
  requirementDetails: string;
  onboardingStatus: "pending" | "in_progress" | "completed";
};

const initialState: ClientOnboardingFormState = {
  legalName: "",
  primaryContactName: "",
  primaryContactEmail: "",
  primaryContactPhone: "",
  industry: "",
  companySize: "",
  preferredCommunication: "email",
  requirementSummary: "",
  requirementDetails: "",
  onboardingStatus: "completed",
};

export function ClientOnboardingForm() {
  const router = useRouter();
  const [form, setForm] = useState<ClientOnboardingFormState>(initialState);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);

  const canSubmit = useMemo(
    () =>
      form.legalName.trim().length >= 2 &&
      form.primaryContactName.trim().length >= 2 &&
      form.primaryContactEmail.trim().includes("@") &&
      form.requirementSummary.trim().length >= 10,
    [form.legalName, form.primaryContactEmail, form.primaryContactName, form.requirementSummary],
  );

  async function submitOnboarding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setCreatedClientId(null);

    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName: form.legalName,
          primaryContactName: form.primaryContactName,
          primaryContactEmail: form.primaryContactEmail,
          primaryContactPhone: form.primaryContactPhone || undefined,
          industry: form.industry || undefined,
          companySize: form.companySize || undefined,
          preferredCommunication: form.preferredCommunication,
          requirementSummary: form.requirementSummary,
          requirementDetails: form.requirementDetails || undefined,
          onboardingStatus: form.onboardingStatus,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Failed to onboard client");
      }

      const newId = String((data.data as { _id?: string })._id ?? "");
      setCreatedClientId(newId.length > 0 ? newId : null);
      setMessage("Client onboarded successfully.");
      setForm(initialState);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to onboard client");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Client Onboarding</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Admin can onboard clients by filling contact info and requirements in one flow.
        </p>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3" onSubmit={submitOnboarding}>
          <Input
            value={form.legalName}
            onChange={(event) => setForm((prev) => ({ ...prev, legalName: event.target.value }))}
            placeholder="Client legal/company name"
            required
          />

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              value={form.primaryContactName}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, primaryContactName: event.target.value }))
              }
              placeholder="Primary contact name"
              required
            />
            <Input
              type="email"
              value={form.primaryContactEmail}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, primaryContactEmail: event.target.value }))
              }
              placeholder="Primary contact email"
              required
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              value={form.primaryContactPhone}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, primaryContactPhone: event.target.value }))
              }
              placeholder="Primary contact phone (optional)"
            />
            <select
              className="h-11 rounded-lg border border-border bg-white px-3 text-sm"
              value={form.preferredCommunication}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  preferredCommunication: event.target.value as ClientOnboardingFormState["preferredCommunication"],
                }))
              }
            >
              <option value="email">Preferred: Email</option>
              <option value="phone">Preferred: Phone</option>
              <option value="whatsapp">Preferred: WhatsApp</option>
              <option value="slack">Preferred: Slack</option>
              <option value="meetings">Preferred: Meetings</option>
            </select>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              value={form.industry}
              onChange={(event) => setForm((prev) => ({ ...prev, industry: event.target.value }))}
              placeholder="Industry (optional)"
            />
            <Input
              value={form.companySize}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, companySize: event.target.value }))
              }
              placeholder="Company size (optional)"
            />
          </div>

          <Textarea
            value={form.requirementSummary}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, requirementSummary: event.target.value }))
            }
            placeholder="Requirement summary (what the client needs)"
            required
          />

          <Textarea
            value={form.requirementDetails}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, requirementDetails: event.target.value }))
            }
            placeholder="Detailed requirement notes (optional)"
          />

          <select
            className="h-11 rounded-lg border border-border bg-white px-3 text-sm md:max-w-xs"
            value={form.onboardingStatus}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                onboardingStatus: event.target.value as ClientOnboardingFormState["onboardingStatus"],
              }))
            }
          >
            <option value="pending">Status: Pending</option>
            <option value="in_progress">Status: In Progress</option>
            <option value="completed">Status: Completed</option>
          </select>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={!canSubmit || saving}>
              {saving ? "Saving..." : "Onboard Client"}
            </Button>
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
            {createdClientId ? (
              <Link
                href={`/clients/${createdClientId}/vault`}
                className="text-sm font-medium text-accent underline-offset-2 hover:underline"
              >
                Open client vault
              </Link>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
