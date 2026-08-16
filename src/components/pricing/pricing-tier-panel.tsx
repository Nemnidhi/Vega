"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export interface PricingTierItem {
  _id: string;
  key: string;
  label: string;
  order: number;
  isActive: boolean;
}

const emptyForm = { key: "", label: "", order: "0" };

export function PricingTierPanel({ initialTiers }: { initialTiers: PricingTierItem[] }) {
  const [tiers, setTiers] = useState(initialTiers);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function startEdit(tier: PricingTierItem) {
    setEditingId(tier._id);
    setForm({ key: tier.key, label: tier.label, order: String(tier.order) });
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const payload = { key: form.key, label: form.label, order: Number(form.order), isActive: true };
      const response = editingId
        ? await fetch(`/api/pricing-tiers/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/pricing-tiers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Failed to save tier");
      }
      const saved = data.data as PricingTierItem;
      setTiers((prev) => {
        const exists = prev.some((tier) => tier._id === saved._id);
        const next = exists ? prev.map((tier) => (tier._id === saved._id ? saved : tier)) : [...prev, saved];
        return next.sort((a, b) => a.order - b.order);
      });
      startCreate();
      setMessage("Tier saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save tier");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(tier: PricingTierItem) {
    const response = await fetch(`/api/pricing-tiers/${tier._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !tier.isActive }),
    });
    const data = await response.json();
    if (response.ok && data.success) {
      setTiers((prev) => prev.map((item) => (item._id === tier._id ? (data.data as PricingTierItem) : item)));
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Edit Tier" : "Add Tier"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-2.5 sm:grid-cols-4" onSubmit={save}>
            <Input
              placeholder="Key (e.g. launch)"
              value={form.key}
              onChange={(event) => setForm((prev) => ({ ...prev, key: event.target.value }))}
              required
            />
            <Input
              placeholder="Label (e.g. Launch Essentials)"
              value={form.label}
              onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
              required
              className="sm:col-span-2"
            />
            <Input
              type="number"
              placeholder="Order"
              value={form.order}
              onChange={(event) => setForm((prev) => ({ ...prev, order: event.target.value }))}
            />
            <div className="flex items-center gap-3 sm:col-span-4">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editingId ? "Update Tier" : "Add Tier"}
              </Button>
              {editingId ? (
                <Button type="button" variant="secondary" onClick={startCreate}>
                  Cancel edit
                </Button>
              ) : null}
              {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tiers ({tiers.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {tiers.map((tier) => (
            <div
              key={tier._id}
              className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
            >
              <span>
                <span className="font-medium">{tier.label}</span>{" "}
                <span className="text-xs text-muted-foreground">({tier.key}, order {tier.order})</span>
              </span>
              <div className="flex items-center gap-2">
                <Badge variant={tier.isActive ? "success" : "neutral"}>
                  {tier.isActive ? "active" : "off"}
                </Badge>
                <Button variant="secondary" size="sm" onClick={() => startEdit(tier)}>
                  Edit
                </Button>
                <Button variant="subtle" size="sm" onClick={() => toggleActive(tier)}>
                  {tier.isActive ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </div>
          ))}
          {tiers.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No tiers yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
