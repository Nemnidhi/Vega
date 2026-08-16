"use client";

import { type FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { PricingCategory, PricingPillar } from "@/types/pricing-component";

const CATEGORY_OPTIONS: PricingCategory[] = [
  "website",
  "mobile",
  "intake",
  "crm",
  "automation",
  "integration",
  "analytics",
  "ai",
  "operations",
];

const PILLAR_OPTIONS: { value: PricingPillar; label: string }[] = [
  { value: "marketing_sales", label: "Marketing & Sales" },
  { value: "operations", label: "Operations" },
  { value: "documentation_admin", label: "Documentation & Administration" },
  { value: "service_support", label: "Service & Support" },
];

const SCALE_TIER_OPTIONS = ["smb", "midmarket", "enterprise"] as const;

type FeatureRow = {
  code: string;
  label: string;
  description: string;
  priceImpact: string;
  isDefault: boolean;
};

export interface PricingComponentItem {
  _id: string;
  code: string;
  title: string;
  description: string;
  category: PricingCategory;
  pillar: PricingPillar;
  basePrice: number;
  complexityMultiplier: number;
  marginPercentage: number;
  finalPrice: number;
  monthlyPrice: number;
  isActive: boolean;
  features: Array<{
    code: string;
    label: string;
    description?: string;
    priceImpact: number;
    isDefault: boolean;
  }>;
  appliesToIndustries: string[];
  appliesToSegments: string[];
  answersGapTags: string[];
  scaleTiers: string[];
  priceBasis: string;
  deliveryWeeksMin: number;
  deliveryWeeksMax: number;
}

export interface SegmentOption {
  id: string;
  label: string;
  industryLabel: string;
}

interface FormState {
  code: string;
  title: string;
  description: string;
  category: PricingCategory;
  pillar: PricingPillar;
  basePrice: string;
  complexityMultiplier: string;
  marginPercentage: string;
  monthlyPrice: string;
  isActive: boolean;
  appliesToIndustries: string;
  appliesToSegments: string[];
  answersGapTags: string;
  scaleTiers: string[];
  priceBasis: string;
  deliveryWeeksMin: string;
  deliveryWeeksMax: string;
  features: FeatureRow[];
}

const emptyFeature: FeatureRow = { code: "", label: "", description: "", priceImpact: "0", isDefault: false };

function initialForm(): FormState {
  return {
    code: "",
    title: "",
    description: "",
    category: "operations",
    pillar: "operations",
    basePrice: "0",
    complexityMultiplier: "1",
    marginPercentage: "30",
    monthlyPrice: "0",
    isActive: true,
    appliesToIndustries: "",
    appliesToSegments: [],
    answersGapTags: "",
    scaleTiers: [],
    priceBasis: "",
    deliveryWeeksMin: "1",
    deliveryWeeksMax: "2",
    features: [],
  };
}

function toForm(item: PricingComponentItem): FormState {
  return {
    code: item.code,
    title: item.title,
    description: item.description,
    category: item.category,
    pillar: item.pillar,
    basePrice: String(item.basePrice),
    complexityMultiplier: String(item.complexityMultiplier),
    marginPercentage: String(item.marginPercentage),
    monthlyPrice: String(item.monthlyPrice ?? 0),
    isActive: item.isActive,
    appliesToIndustries: item.appliesToIndustries.join(", "),
    appliesToSegments: item.appliesToSegments,
    answersGapTags: item.answersGapTags.join(", "),
    scaleTiers: item.scaleTiers,
    priceBasis: item.priceBasis,
    deliveryWeeksMin: String(item.deliveryWeeksMin),
    deliveryWeeksMax: String(item.deliveryWeeksMax),
    features: item.features.map((feature) => ({
      code: feature.code,
      label: feature.label,
      description: feature.description ?? "",
      priceImpact: String(feature.priceImpact),
      isDefault: feature.isDefault,
    })),
  };
}

function toPayload(form: FormState) {
  return {
    code: form.code,
    title: form.title,
    description: form.description,
    category: form.category,
    pillar: form.pillar,
    basePrice: Number(form.basePrice),
    complexityMultiplier: Number(form.complexityMultiplier),
    marginPercentage: Number(form.marginPercentage),
    monthlyPrice: Number(form.monthlyPrice),
    isActive: form.isActive,
    appliesToIndustries: form.appliesToIndustries
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    appliesToSegments: form.appliesToSegments,
    answersGapTags: form.answersGapTags
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    scaleTiers: form.scaleTiers,
    priceBasis: form.priceBasis,
    deliveryWeeksMin: Number(form.deliveryWeeksMin),
    deliveryWeeksMax: Number(form.deliveryWeeksMax),
    features: form.features
      .filter((feature) => feature.code.trim() && feature.label.trim())
      .map((feature) => ({
        code: feature.code,
        label: feature.label,
        description: feature.description,
        priceImpact: Number(feature.priceImpact) || 0,
        isDefault: feature.isDefault,
      })),
  };
}

interface Props {
  initialComponents: PricingComponentItem[];
  segments: SegmentOption[];
}

export function PricingComponentPanel({ initialComponents, segments }: Props) {
  const [components, setComponents] = useState(initialComponents);
  const [form, setForm] = useState<FormState>(initialForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [filterPillar, setFilterPillar] = useState<string>("all");

  const filtered = useMemo(
    () =>
      filterPillar === "all"
        ? components
        : components.filter((component) => component.pillar === filterPillar),
    [components, filterPillar],
  );

  function startCreate() {
    setEditingId(null);
    setForm(initialForm());
    setMessage("");
  }

  function startEdit(item: PricingComponentItem) {
    setEditingId(item._id);
    setForm(toForm(item));
    setMessage("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const payload = toPayload(form);
      const response = editingId
        ? await fetch(`/api/pricing-components/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/pricing-components", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Failed to save pricing component");
      }

      const saved = data.data as PricingComponentItem;
      setComponents((prev) => {
        const exists = prev.some((component) => component._id === saved._id);
        return exists
          ? prev.map((component) => (component._id === saved._id ? saved : component))
          : [saved, ...prev];
      });
      setMessage(editingId ? "Component updated." : "Component created.");
      startCreate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save component");
    } finally {
      setSaving(false);
    }
  }

  function addFeatureRow() {
    setForm((prev) => ({ ...prev, features: [...prev.features, { ...emptyFeature }] }));
  }

  function updateFeatureRow(index: number, patch: Partial<FeatureRow>) {
    setForm((prev) => ({
      ...prev,
      features: prev.features.map((feature, featureIndex) =>
        featureIndex === index ? { ...feature, ...patch } : feature,
      ),
    }));
  }

  function removeFeatureRow(index: number) {
    setForm((prev) => ({
      ...prev,
      features: prev.features.filter((_, featureIndex) => featureIndex !== index),
    }));
  }

  function toggleSegment(id: string) {
    setForm((prev) => ({
      ...prev,
      appliesToSegments: prev.appliesToSegments.includes(id)
        ? prev.appliesToSegments.filter((value) => value !== id)
        : [...prev.appliesToSegments, id],
    }));
  }

  function toggleScaleTier(tier: string) {
    setForm((prev) => ({
      ...prev,
      scaleTiers: prev.scaleTiers.includes(tier)
        ? prev.scaleTiers.filter((value) => value !== tier)
        : [...prev.scaleTiers, tier],
    }));
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Edit Component" : "New Component"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={save}>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                placeholder="Code (e.g. WEB_PRESENCE)"
                value={form.code}
                onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                required
              />
              <Input
                placeholder="Title"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                required
                className="sm:col-span-2"
              />
            </div>

            <Textarea
              placeholder="Description"
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              required
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <select
                className="h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm"
                value={form.pillar}
                onChange={(event) => setForm((prev) => ({ ...prev, pillar: event.target.value as PricingPillar }))}
              >
                {PILLAR_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                className="h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm"
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value as PricingCategory }))}
              >
                {CATEGORY_OPTIONS.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <label className="text-xs text-muted-foreground">
                Base price
                <Input
                  type="number"
                  min={0}
                  value={form.basePrice}
                  onChange={(event) => setForm((prev) => ({ ...prev, basePrice: event.target.value }))}
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Complexity ×
                <Input
                  type="number"
                  min={1}
                  step={0.05}
                  value={form.complexityMultiplier}
                  onChange={(event) => setForm((prev) => ({ ...prev, complexityMultiplier: event.target.value }))}
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Margin %
                <Input
                  type="number"
                  min={0}
                  max={300}
                  value={form.marginPercentage}
                  onChange={(event) => setForm((prev) => ({ ...prev, marginPercentage: event.target.value }))}
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Monthly price
                <Input
                  type="number"
                  min={0}
                  value={form.monthlyPrice}
                  onChange={(event) => setForm((prev) => ({ ...prev, monthlyPrice: event.target.value }))}
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs text-muted-foreground">
                Delivery weeks (min)
                <Input
                  type="number"
                  min={0}
                  value={form.deliveryWeeksMin}
                  onChange={(event) => setForm((prev) => ({ ...prev, deliveryWeeksMin: event.target.value }))}
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Delivery weeks (max)
                <Input
                  type="number"
                  min={0}
                  value={form.deliveryWeeksMax}
                  onChange={(event) => setForm((prev) => ({ ...prev, deliveryWeeksMax: event.target.value }))}
                />
              </label>
              <label className="flex items-center gap-2 self-end pb-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                />
                Active
              </label>
            </div>

            <label className="text-xs text-muted-foreground">
              Price basis / provenance note
              <Input
                placeholder="Where this number came from"
                value={form.priceBasis}
                onChange={(event) => setForm((prev) => ({ ...prev, priceBasis: event.target.value }))}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-muted-foreground">
                Applies to industries (comma separated keys, blank = all)
                <Input
                  placeholder="textile_apparel, leather_footwear"
                  value={form.appliesToIndustries}
                  onChange={(event) => setForm((prev) => ({ ...prev, appliesToIndustries: event.target.value }))}
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Answers gap tags (comma separated)
                <Input
                  placeholder="website, seo"
                  value={form.answersGapTags}
                  onChange={(event) => setForm((prev) => ({ ...prev, answersGapTags: event.target.value }))}
                />
              </label>
            </div>

            <div>
              <p className="mb-1.5 text-xs text-muted-foreground">Scale tiers</p>
              <div className="flex flex-wrap gap-3">
                {SCALE_TIER_OPTIONS.map((tier) => (
                  <label key={tier} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={form.scaleTiers.includes(tier)}
                      onChange={() => toggleScaleTier(tier)}
                    />
                    {tier}
                  </label>
                ))}
              </div>
            </div>

            {segments.length > 0 ? (
              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">
                  Applies to segments (blank = every segment of the applicable industries)
                </p>
                <div className="max-h-40 overflow-y-auto rounded-xl border border-border/70 p-2.5">
                  {segments.map((segment) => (
                    <label key={segment.id} className="flex items-center gap-1.5 py-0.5 text-sm">
                      <input
                        type="checkbox"
                        checked={form.appliesToSegments.includes(segment.id)}
                        onChange={() => toggleSegment(segment.id)}
                      />
                      {segment.industryLabel} — {segment.label}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Features (options selectable within this component)</p>
                <Button type="button" variant="subtle" size="sm" onClick={addFeatureRow}>
                  Add feature
                </Button>
              </div>
              <div className="space-y-2">
                {form.features.map((feature, index) => (
                  <div key={index} className="grid gap-2 rounded-xl border border-border/70 p-3 sm:grid-cols-6">
                    <Input
                      className="sm:col-span-1"
                      placeholder="CODE"
                      value={feature.code}
                      onChange={(event) => updateFeatureRow(index, { code: event.target.value })}
                    />
                    <Input
                      className="sm:col-span-2"
                      placeholder="Label"
                      value={feature.label}
                      onChange={(event) => updateFeatureRow(index, { label: event.target.value })}
                    />
                    <Input
                      className="sm:col-span-1"
                      type="number"
                      placeholder="Price impact"
                      value={feature.priceImpact}
                      onChange={(event) => updateFeatureRow(index, { priceImpact: event.target.value })}
                    />
                    <label className="flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={feature.isDefault}
                        onChange={(event) => updateFeatureRow(index, { isDefault: event.target.checked })}
                      />
                      Default
                    </label>
                    <Button type="button" variant="danger" size="sm" onClick={() => removeFeatureRow(index)}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editingId ? "Update Component" : "Create Component"}
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Components ({filtered.length})</CardTitle>
            <select
              className="h-9 rounded-xl border border-border/70 bg-background px-3 text-sm"
              value={filterPillar}
              onChange={(event) => setFilterPillar(event.target.value)}
            >
              <option value="all">All pillars</option>
              {PILLAR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3">Code</th>
                <th className="py-2 pr-3">Title</th>
                <th className="py-2 pr-3">Pillar</th>
                <th className="py-2 pr-3">Final price</th>
                <th className="py-2 pr-3">Monthly</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((component) => (
                <tr key={component._id} className="border-b border-border/40">
                  <td className="py-2 pr-3 font-mono text-xs">{component.code}</td>
                  <td className="py-2 pr-3">{component.title}</td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">
                    {PILLAR_OPTIONS.find((option) => option.value === component.pillar)?.label ?? component.pillar}
                  </td>
                  <td className="py-2 pr-3">₹{component.finalPrice.toLocaleString("en-IN")}</td>
                  <td className="py-2 pr-3">₹{component.monthlyPrice.toLocaleString("en-IN")}</td>
                  <td className="py-2 pr-3">
                    <Badge variant={component.isActive ? "success" : "neutral"}>
                      {component.isActive ? "active" : "inactive"}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3">
                    <Button variant="secondary" size="sm" onClick={() => startEdit(component)}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                    No components yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
