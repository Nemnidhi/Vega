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
];

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
  const index = stageOrder.indexOf(stage);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

export function PipelineLeadList({ leads }: { leads: PipelineLeadRow[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<"all" | string>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | string>("all");

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

        <div className="overflow-x-auto">
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
