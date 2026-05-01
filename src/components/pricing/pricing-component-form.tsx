"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type PricingForm = {
  code: string;
  title: string;
  description: string;
  category: "intake" | "crm" | "automation" | "integration" | "analytics" | "ai" | "operations";
  basePrice: string;
  complexityMultiplier: string;
  marginPercentage: string;
};

const initialForm: PricingForm = {
  code: "",
  title: "",
  description: "",
  category: "operations",
  basePrice: "0",
  complexityMultiplier: "1",
  marginPercentage: "30",
};

export function PricingComponentForm() {
  const [form, setForm] = useState<PricingForm>(initialForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function saveComponent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/pricing-components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          basePrice: Number(form.basePrice),
          complexityMultiplier: Number(form.complexityMultiplier),
          marginPercentage: Number(form.marginPercentage),
          isActive: true,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Failed to save pricing component");
      }

      setMessage("Pricing component saved.");
      setForm(initialForm);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save pricing component");
    } finally {
      setLoading(false);
    }
  }

  async function seedDefaults() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/pricing-components/seed", { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Failed to seed pricing components");
      }
      setMessage(`Seeded ${data.data.seeded} components.`);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to seed pricing components");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dynamic Pricing Engine</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3" onSubmit={saveComponent}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Code"
              value={form.code}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))
              }
              required
            />
            <Input
              placeholder="Title"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              required
            />
          </div>
          <Textarea
            placeholder="Description"
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, description: event.target.value }))
            }
            required
          />
          <select
            className="h-11 rounded-lg border border-border bg-white px-3 text-sm"
            value={form.category}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                category: event.target.value as PricingForm["category"],
              }))
            }
          >
            <option value="intake">Intake</option>
            <option value="crm">CRM</option>
            <option value="automation">Automation</option>
            <option value="integration">Integration</option>
            <option value="analytics">Analytics</option>
            <option value="ai">AI</option>
            <option value="operations">Operations</option>
          </select>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              type="number"
              placeholder="Base price"
              value={form.basePrice}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, basePrice: event.target.value }))
              }
              required
            />
            <Input
              type="number"
              placeholder="Complexity"
              value={form.complexityMultiplier}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, complexityMultiplier: event.target.value }))
              }
              required
            />
            <Input
              type="number"
              placeholder="Margin %"
              value={form.marginPercentage}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, marginPercentage: event.target.value }))
              }
              required
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Component"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={seedDefaults}
            >
              Seed Default Components
            </Button>
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
