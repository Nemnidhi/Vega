"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

type LeadRow = {
  _id: string;
  title: string;
  contactName: string;
  source: string;
  status: string;
  updatedAt?: string;
};

type StatusTab = "all" | "new" | "contacted";

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

export function LeadListWithStatusTabs({ leads }: { leads: LeadRow[] }) {
  const [activeTab, setActiveTab] = useState<StatusTab>("all");

  const counts = useMemo(() => {
    const newCount = leads.filter((lead) => lead.status === "new").length;
    const contactedCount = leads.filter((lead) => lead.status === "contacted").length;
    return {
      all: leads.length,
      new: newCount,
      contacted: contactedCount,
    };
  }, [leads]);

  const filteredLeads = useMemo(() => {
    if (activeTab === "all") {
      return leads;
    }
    return leads.filter((lead) => lead.status === activeTab);
  }, [activeTab, leads]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
            activeTab === "all"
              ? "border-accent bg-accent/10 text-accent-strong"
              : "border-border bg-white text-muted-foreground hover:border-accent/40"
          }`}
        >
          All {counts.all}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("new")}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
            activeTab === "new"
              ? "border-accent bg-accent/10 text-accent-strong"
              : "border-border bg-white text-muted-foreground hover:border-accent/40"
          }`}
        >
          New {counts.new}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("contacted")}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
            activeTab === "contacted"
              ? "border-accent bg-accent/10 text-accent-strong"
              : "border-border bg-white text-muted-foreground hover:border-accent/40"
          }`}
        >
          Contacted {counts.contacted}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-2 py-2">Lead</th>
              <th className="px-2 py-2">Source</th>
              <th className="px-2 py-2">Status</th>
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
                <td className="px-2 py-3">{lead.source.replaceAll("_", " ")}</td>
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
            ))}
            {filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-2 py-6 text-center text-muted-foreground">
                  No leads in this status.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
