"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export interface IndustryOption {
  id: string;
  key: string;
  label: string;
}

export interface SegmentOption {
  id: string;
  industryId: string;
  label: string;
}

export interface TierOption {
  id: string;
  key: string;
  label: string;
  order: number;
}

export interface ComponentOption {
  id: string;
  code: string;
  title: string;
  pillar: string;
}

type InclusionStatus = "included" | "addon" | "unavailable";

type PillarPricing = {
  marketing_sales: number;
  operations: number;
  documentation_admin: number;
  service_support: number;
};

const emptyPillarPricing: PillarPricing = {
  marketing_sales: 0,
  operations: 0,
  documentation_admin: 0,
  service_support: 0,
};

type TierState = {
  packageId: string | null;
  setupPrice: string;
  monthlyPrice: string;
  bestForDescription: string;
  pillarPricing: PillarPricing;
  inclusions: Record<string, InclusionStatus>;
};

function emptyTierState(): TierState {
  return {
    packageId: null,
    setupPrice: "0",
    monthlyPrice: "0",
    bestForDescription: "",
    pillarPricing: { ...emptyPillarPricing },
    inclusions: {},
  };
}

const PILLAR_LABELS: Record<string, string> = {
  marketing_sales: "Marketing & Sales",
  operations: "Operations",
  documentation_admin: "Documentation & Administration",
  service_support: "Service & Support",
};

const STATUS_LABELS: Record<InclusionStatus, string> = {
  included: "Included",
  addon: "Add-on",
  unavailable: "—",
};

interface RawPackage {
  _id: string;
  tierId: string;
  setupPrice: number;
  monthlyPrice: number;
  bestForDescription: string;
  pillarPricing: PillarPricing;
  componentInclusions: Array<{ componentId: string; status: InclusionStatus }>;
}

interface Props {
  industries: IndustryOption[];
  segments: SegmentOption[];
  tiers: TierOption[];
  components: ComponentOption[];
}

export function PricingPackagePanel({ industries, segments, tiers, components }: Props) {
  const [industryId, setIndustryId] = useState<string>(industries[0]?.id ?? "");
  const [segmentId, setSegmentId] = useState<string>("__none__");
  const [pillarFilter, setPillarFilter] = useState<string>("all");
  const [tierStates, setTierStates] = useState<Record<string, TierState>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const segmentsForIndustry = useMemo(
    () => segments.filter((segment) => segment.industryId === industryId),
    [segments, industryId],
  );

  const filteredComponents = useMemo(
    () =>
      pillarFilter === "all" ? components : components.filter((component) => component.pillar === pillarFilter),
    [components, pillarFilter],
  );

  useEffect(() => {
    if (!industryId) return;

    async function loadPackages() {
      setLoading(true);
      setMessage("");

      try {
        const params = new URLSearchParams({ industryId });
        params.set("segmentId", segmentId === "__none__" ? "null" : segmentId);

        const response = await fetch(`/api/pricing-packages?${params.toString()}`);
        const data = await response.json();
        if (!data.success) throw new Error(data?.error?.message ?? "Failed to load packages");

        const packages = data.data as RawPackage[];
        const nextState: Record<string, TierState> = {};
        for (const tier of tiers) {
          const existing = packages.find((pkg) => pkg.tierId === tier.id);
          if (existing) {
            const inclusions: Record<string, InclusionStatus> = {};
            for (const inclusion of existing.componentInclusions) {
              inclusions[inclusion.componentId] = inclusion.status;
            }
            nextState[tier.id] = {
              packageId: existing._id,
              setupPrice: String(existing.setupPrice),
              monthlyPrice: String(existing.monthlyPrice),
              bestForDescription: existing.bestForDescription,
              pillarPricing: existing.pillarPricing ?? { ...emptyPillarPricing },
              inclusions,
            };
          } else {
            nextState[tier.id] = emptyTierState();
          }
        }
        setTierStates(nextState);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to load packages");
      } finally {
        setLoading(false);
      }
    }

    void loadPackages();
  }, [industryId, segmentId, tiers]);

  function setInclusion(tierId: string, componentId: string, status: InclusionStatus) {
    setTierStates((prev) => ({
      ...prev,
      [tierId]: {
        ...(prev[tierId] ?? emptyTierState()),
        inclusions: { ...(prev[tierId]?.inclusions ?? {}), [componentId]: status },
      },
    }));
  }

  function cycleInclusion(tierId: string, componentId: string) {
    const current = tierStates[tierId]?.inclusions[componentId] ?? "unavailable";
    const next: InclusionStatus =
      current === "unavailable" ? "addon" : current === "addon" ? "included" : "unavailable";
    setInclusion(tierId, componentId, next);
  }

  function updateTierField(tierId: string, patch: Partial<TierState>) {
    setTierStates((prev) => ({ ...prev, [tierId]: { ...(prev[tierId] ?? emptyTierState()), ...patch } }));
  }

  function updatePillarPrice(tierId: string, pillar: keyof PillarPricing, value: string) {
    setTierStates((prev) => ({
      ...prev,
      [tierId]: {
        ...(prev[tierId] ?? emptyTierState()),
        pillarPricing: { ...(prev[tierId]?.pillarPricing ?? emptyPillarPricing), [pillar]: Number(value) || 0 },
      },
    }));
  }

  async function saveAll() {
    if (!industryId) return;
    setSaving(true);
    setMessage("");

    try {
      const results = await Promise.all(
        tiers.map(async (tier) => {
          const state = tierStates[tier.id] ?? emptyTierState();
          const payload = {
            industryId,
            segmentId: segmentId === "__none__" ? null : segmentId,
            tierId: tier.id,
            setupPrice: Number(state.setupPrice) || 0,
            monthlyPrice: Number(state.monthlyPrice) || 0,
            bestForDescription: state.bestForDescription,
            pillarPricing: state.pillarPricing,
            componentInclusions: Object.entries(state.inclusions)
              .filter(([, status]) => status !== "unavailable")
              .map(([componentId, status]) => ({ componentId, status })),
            isActive: true,
          };

          const response = state.packageId
            ? await fetch(`/api/pricing-packages/${state.packageId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              })
            : await fetch("/api/pricing-packages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
          const data = await response.json();
          if (!response.ok || !data.success) {
            throw new Error(data?.error?.message ?? `Failed to save ${tier.label}`);
          }
          return data.data as RawPackage;
        }),
      );

      setTierStates((prev) => {
        const next = { ...prev };
        for (const pkg of results) {
          next[pkg.tierId] = { ...next[pkg.tierId], packageId: pkg._id };
        }
        return next;
      });
      setMessage("All tiers saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save packages");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-5">
          <label className="text-xs text-muted-foreground">
            Industry
            <select
              className="h-11 min-w-[220px] rounded-xl border border-border/70 bg-background px-3 text-sm"
              value={industryId}
              onChange={(event) => {
                setIndustryId(event.target.value);
                setSegmentId("__none__");
              }}
            >
              {industries.map((industry) => (
                <option key={industry.id} value={industry.id}>
                  {industry.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-muted-foreground">
            Business type
            <select
              className="h-11 min-w-[220px] rounded-xl border border-border/70 bg-background px-3 text-sm"
              value={segmentId}
              onChange={(event) => setSegmentId(event.target.value)}
            >
              <option value="__none__">No segment breakdown (whole industry)</option>
              {segmentsForIndustry.map((segment) => (
                <option key={segment.id} value={segment.id}>
                  {segment.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-muted-foreground">
            Pillar filter
            <select
              className="h-11 min-w-[220px] rounded-xl border border-border/70 bg-background px-3 text-sm"
              value={pillarFilter}
              onChange={(event) => setPillarFilter(event.target.value)}
            >
              <option value="all">All pillars</option>
              {Object.entries(PILLAR_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <Button onClick={saveAll} disabled={saving || loading || !industryId}>
            {saving ? "Saving..." : "Save all tiers"}
          </Button>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Package pricing per tier</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3">Field</th>
                {tiers.map((tier) => (
                  <th key={tier.id} className="py-2 pr-3">
                    {tier.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/40">
                <td className="py-2 pr-3 font-medium">Setup price</td>
                {tiers.map((tier) => (
                  <td key={tier.id} className="py-2 pr-3">
                    <Input
                      type="number"
                      min={0}
                      value={tierStates[tier.id]?.setupPrice ?? "0"}
                      onChange={(event) => updateTierField(tier.id, { setupPrice: event.target.value })}
                    />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border/40">
                <td className="py-2 pr-3 font-medium">Monthly price</td>
                {tiers.map((tier) => (
                  <td key={tier.id} className="py-2 pr-3">
                    <Input
                      type="number"
                      min={0}
                      value={tierStates[tier.id]?.monthlyPrice ?? "0"}
                      onChange={(event) => updateTierField(tier.id, { monthlyPrice: event.target.value })}
                    />
                  </td>
                ))}
              </tr>
              {(Object.keys(PILLAR_LABELS) as Array<keyof PillarPricing>).map((pillar) => (
                <tr key={pillar} className="border-b border-border/40">
                  <td className="py-2 pr-3 font-medium">{PILLAR_LABELS[pillar]} price</td>
                  {tiers.map((tier) => (
                    <td key={tier.id} className="py-2 pr-3">
                      <Input
                        type="number"
                        min={0}
                        value={tierStates[tier.id]?.pillarPricing[pillar] ?? 0}
                        onChange={(event) => updatePillarPrice(tier.id, pillar, event.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="py-2 pr-3 font-medium align-top">Best for</td>
                {tiers.map((tier) => (
                  <td key={tier.id} className="py-2 pr-3">
                    <Input
                      value={tierStates[tier.id]?.bestForDescription ?? ""}
                      onChange={(event) => updateTierField(tier.id, { bestForDescription: event.target.value })}
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Component inclusion matrix ({filteredComponents.length} components)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading packages...</p>
          ) : (
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Component</th>
                  {tiers.map((tier) => (
                    <th key={tier.id} className="py-2 pr-3">
                      {tier.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredComponents.map((component) => (
                  <tr key={component.id} className="border-b border-border/40">
                    <td className="py-2 pr-3">
                      <span className="font-medium">{component.title}</span>{" "}
                      <span className="text-xs text-muted-foreground">({component.code})</span>
                    </td>
                    {tiers.map((tier) => {
                      const status = tierStates[tier.id]?.inclusions[component.id] ?? "unavailable";
                      return (
                        <td key={tier.id} className="py-2 pr-3">
                          <button
                            type="button"
                            onClick={() => cycleInclusion(tier.id, component.id)}
                            className={`h-9 w-28 rounded-lg border text-xs font-semibold transition-colors ${
                              status === "included"
                                ? "border-success/40 bg-success/10 text-success"
                                : status === "addon"
                                  ? "border-warning/40 bg-warning/10 text-warning"
                                  : "border-border/70 bg-white/70 text-muted-foreground"
                            }`}
                          >
                            {STATUS_LABELS[status]}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {filteredComponents.length === 0 ? (
                  <tr>
                    <td colSpan={tiers.length + 1} className="py-6 text-center text-sm text-muted-foreground">
                      No components for this pillar filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
