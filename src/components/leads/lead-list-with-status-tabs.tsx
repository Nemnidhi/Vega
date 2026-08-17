"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  TIER_LABEL,
  TIER_ORDER,
  TIER_VARIANT,
  humanizeKey,
  isTier,
} from "@/lib/prospecting/tier-display";

type LeadRow = {
  _id: string;
  title: string;
  contactName?: string;
  source: string;
  status: string;
  updatedAt?: string;
  prospecting?: {
    industry?: string;
    segment?: string;
    prospectingStatus?: string;
    classification?: { category?: string };
  } | null;
};

type StatusTab = "all" | "new" | "contacted";
type TierFilter = "all" | "A" | "B" | "C" | "D" | "unclassified";
type SourceFilter = "all" | string;

function statusLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function statusVariant(status: string): "danger" | "warning" | "success" | "accent" | "neutral" {
  if (status === "closed_lost") return "danger";
  if (status === "closed_won") return "success";
  if (status === "proposal_sent" || status === "negotiation") return "warning";
  if (status === "qualified") return "accent";
  return "neutral";
}

function tierOf(lead: LeadRow) {
  return lead.prospecting?.classification?.category;
}

export function LeadListWithStatusTabs({ leads }: { leads: LeadRow[] }) {
  const [activeTab, setActiveTab] = useState<StatusTab>("all");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  const counts = useMemo(
    () => ({
      all: leads.length,
      new: leads.filter((lead) => lead.status === "new").length,
      contacted: leads.filter((lead) => lead.status === "contacted").length,
    }),
    [leads],
  );

  // Only cold prospects carry an audit tier, so the tier filter is hidden
  // entirely on a board of purely inbound leads.
  const prospects = useMemo(() => leads.filter((lead) => Boolean(lead.prospecting)), [leads]);

  const tierCounts = useMemo(() => {
    const result: Record<string, number> = { unclassified: 0 };
    for (const tier of TIER_ORDER) result[tier] = 0;
    for (const lead of prospects) {
      const tier = tierOf(lead);
      if (isTier(tier)) result[tier] += 1;
      else result.unclassified += 1;
    }
    return result;
  }, [prospects]);

  const sourceOrder = useMemo(
    () => Array.from(new Set(leads.map((lead) => lead.source))).sort(),
    [leads],
  );
  const sourceCounts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const source of sourceOrder) {
      result[source] = leads.filter((lead) => lead.source === source).length;
    }
    return result;
  }, [sourceOrder, leads]);

  const filteredLeads = useMemo(() => {
    let rows = activeTab === "all" ? leads : leads.filter((lead) => lead.status === activeTab);

    if (tierFilter !== "all") {
      rows = rows.filter((lead) => {
        const tier = tierOf(lead);
        if (tierFilter === "unclassified") return Boolean(lead.prospecting) && !isTier(tier);
        return tier === tierFilter;
      });
    }
    if (sourceFilter !== "all") {
      rows = rows.filter((lead) => lead.source === sourceFilter);
    }
    return rows;
  }, [activeTab, tierFilter, sourceFilter, leads]);

  const tabClass = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
      active
        ? "border-accent bg-accent/10 text-accent-strong"
        : "border-border bg-white text-muted-foreground hover:border-accent/40"
    }`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setActiveTab("all")} className={tabClass(activeTab === "all")}>
          All {counts.all}
        </button>
        <button type="button" onClick={() => setActiveTab("new")} className={tabClass(activeTab === "new")}>
          New {counts.new}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("contacted")}
          className={tabClass(activeTab === "contacted")}
        >
          Contacted {counts.contacted}
        </button>
      </div>

      {prospects.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Audit tier</span>
          <button type="button" onClick={() => setTierFilter("all")} className={tabClass(tierFilter === "all")}>
            All {prospects.length}
          </button>
          {TIER_ORDER.map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => setTierFilter(tier)}
              className={tabClass(tierFilter === tier)}
              title={TIER_LABEL[tier]}
            >
              {tier} {tierCounts[tier]}
            </button>
          ))}
          {tierCounts.unclassified > 0 ? (
            <button
              type="button"
              onClick={() => setTierFilter("unclassified")}
              className={tabClass(tierFilter === "unclassified")}
              title="Cold prospects with no classification yet"
            >
              Unclassified {tierCounts.unclassified}
            </button>
          ) : null}
        </div>
      ) : null}

      {sourceOrder.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Source</span>
          <button
            type="button"
            onClick={() => setSourceFilter("all")}
            className={tabClass(sourceFilter === "all")}
          >
            All {leads.length}
          </button>
          {sourceOrder.map((source) => (
            <button
              key={source}
              type="button"
              onClick={() => setSourceFilter(source)}
              className={tabClass(sourceFilter === source)}
            >
              {source.replaceAll("_", " ")} {sourceCounts[source]}
            </button>
          ))}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-2 py-2">Lead</th>
              <th className="px-2 py-2">Source</th>
              <th className="px-2 py-2">Industry</th>
              <th className="px-2 py-2">Tier</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">View</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.map((lead) => {
              const tier = tierOf(lead);
              return (
                <tr key={lead._id} className="border-b border-border/70">
                  <td className="px-2 py-3">
                    <p className="font-semibold text-foreground">{lead.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {lead.contactName || (lead.prospecting ? "No contact sourced" : "-")}
                    </p>
                  </td>
                  <td className="px-2 py-3">{lead.source.replaceAll("_", " ")}</td>
                  <td className="px-2 py-3">
                    {lead.prospecting?.industry ? (
                      <>
                        <p className="text-foreground">{humanizeKey(lead.prospecting.industry)}</p>
                        {lead.prospecting.segment ? (
                          <p className="text-xs text-muted-foreground">
                            {humanizeKey(lead.prospecting.segment)}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    {isTier(tier) ? (
                      <Badge variant={TIER_VARIANT[tier]} title={TIER_LABEL[tier]}>
                        {tier}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    <Badge variant={statusVariant(lead.status)}>{statusLabel(lead.status)}</Badge>
                  </td>
                  <td className="px-2 py-3">
                    <Link
                      href={`/leads/${lead._id}`}
                      prefetch={false}
                      className="text-accent hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-2 py-6 text-center text-muted-foreground">
                  No leads match this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
