"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LeadStatusSelect } from "@/components/leads/lead-status-select";

type PipelineLeadRow = {
  _id: string;
  title: string;
  contactName: string;
  priorityBand: string;
  stage: string;
};

const stageOrder = [
  "new",
  "contacted",
  "qualified",
  "proposal_sent",
  "negotiation",
  "closed_won",
  "closed_lost",
] as const;

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function priorityVariant(priorityBand: string): "danger" | "warning" | "accent" | "neutral" {
  if (priorityBand === "heavy_artillery") return "danger";
  if (priorityBand === "standard_sales") return "warning";
  if (priorityBand === "volume_pipeline") return "accent";
  return "neutral";
}

function stageSortIndex(stage: string) {
  const index = stageOrder.findIndex((stageName) => stageName === stage);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

export function PipelineLeadList({ leads }: { leads: PipelineLeadRow[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<"all" | string>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | string>("all");

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { all: leads.length };
    for (const stage of stageOrder) {
      counts[stage] = 0;
    }
    for (const lead of leads) {
      if (typeof counts[lead.stage] === "number") {
        counts[lead.stage] += 1;
      }
    }
    return counts;
  }, [leads]);

  const stageOptions = useMemo(() => {
    const options = Array.from(new Set(leads.map((lead) => lead.stage)));
    return options.sort((left, right) => stageSortIndex(left) - stageSortIndex(right));
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();

    return [...leads]
      .filter((lead) => {
        const searchMatch =
          term.length === 0 ||
          lead.title.toLowerCase().includes(term) ||
          lead.contactName.toLowerCase().includes(term);
        const stageMatch = stageFilter === "all" || lead.stage === stageFilter;
        const priorityMatch = priorityFilter === "all" || lead.priorityBand === priorityFilter;
        return searchMatch && stageMatch && priorityMatch;
      })
      .sort((left, right) => {
        const byStage = stageSortIndex(left.stage) - stageSortIndex(right.stage);
        if (byStage !== 0) return byStage;
        return left.title.localeCompare(right.title);
      });
  }, [leads, priorityFilter, searchQuery, stageFilter]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline Lead List</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {(["all", ...stageOrder] as const).map((stage) => {
            const isActive = stageFilter === stage;
            const label = stage === "all" ? "All" : humanize(stage);
            const count = stageCounts[stage] ?? 0;
            return (
              <button
                key={stage}
                type="button"
                onClick={() => setStageFilter(stage)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                  isActive
                    ? "border-accent bg-accent/10 text-accent-strong"
                    : "border-border bg-white text-muted-foreground hover:border-accent/40"
                }`}
              >
                {label} {count}
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search lead or contact"
            className="md:col-span-2"
          />

          <select
            className="h-11 rounded-lg border border-border bg-white px-3 text-sm"
            value={stageFilter}
            onChange={(event) => setStageFilter(event.target.value)}
          >
            <option value="all">All stages</option>
            {stageOptions.map((stage) => (
              <option key={stage} value={stage}>
                {humanize(stage)}
              </option>
            ))}
          </select>

          <select
            className="h-11 rounded-lg border border-border bg-white px-3 text-sm"
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
          >
            <option value="all">All priority bands</option>
            <option value="heavy_artillery">Heavy Artillery</option>
            <option value="standard_sales">Standard Pipeline</option>
            <option value="volume_pipeline">Volume Pipeline</option>
          </select>
        </div>

        <div className="space-y-3 md:hidden">
          {filteredLeads.map((lead) => (
            <article
              key={lead._id}
              className="rounded-xl border border-border bg-white p-3 shadow-sm"
            >
              <p className="text-sm font-semibold text-foreground break-words">{lead.title}</p>
              <p className="mt-1 text-xs text-muted-foreground break-words">{lead.contactName}</p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <Badge variant={priorityVariant(lead.priorityBand)}>
                  {humanize(lead.priorityBand)}
                </Badge>
                <Link href={`/leads/${lead._id}`} className="text-sm font-medium text-accent hover:underline">
                  Open
                </Link>
              </div>
              <div className="mt-3">
                <LeadStatusSelect leadId={lead._id} currentStatus={lead.stage} />
              </div>
            </article>
          ))}

          {filteredLeads.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface-soft/60 px-4 py-8 text-center text-sm text-muted-foreground">
              No leads found for selected filters.
            </div>
          ) : null}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-2 py-2">Lead</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Priority</th>
                <th className="px-2 py-2">View</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => (
                <tr key={lead._id} className="border-b border-border/70">
                  <td className="px-2 py-3">
                    <p className="font-semibold text-foreground">{lead.title}</p>
                    <p className="text-xs text-muted-foreground">{lead.contactName}</p>
                  </td>
                  <td className="px-2 py-3">
                    <LeadStatusSelect leadId={lead._id} currentStatus={lead.stage} />
                  </td>
                  <td className="px-2 py-3">
                    <Badge variant={priorityVariant(lead.priorityBand)}>
                      {humanize(lead.priorityBand)}
                    </Badge>
                  </td>
                  <td className="px-2 py-3">
                    <Link href={`/leads/${lead._id}`} className="text-accent hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}

              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-2 py-6 text-center text-muted-foreground">
                    No leads found for selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
