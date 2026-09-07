"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CalendarDays, CheckCircle2, Clock, Layers, TimerReset } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LeadRef =
  | string
  | {
      _id: string;
      title?: string;
      contactName?: string;
      email?: string;
      phone?: string;
      status?: string;
    }
  | null;

type UserRef = string | { fullName?: string; email?: string; role?: string } | null;

export type FollowUpsWorkspaceItem = {
  _id: string;
  leadId: LeadRef;
  status: string;
  channel: string;
  priority: string;
  dueAt: string;
  nextAction: string;
  notes?: string;
  outcome?: string | null;
  outcomeNote?: string;
  assignedToUserId?: UserRef;
};

const views = ["open", "overdue", "today", "upcoming", "completed", "all"] as const;
const viewMeta = {
  open: { icon: CalendarDays, tone: "bg-blue-500/15 text-blue-300" },
  overdue: { icon: Clock, tone: "bg-danger/15 text-danger" },
  today: { icon: TimerReset, tone: "bg-warning/15 text-warning" },
  upcoming: { icon: ArrowUpRight, tone: "bg-blue-500/15 text-blue-300" },
  completed: { icon: CheckCircle2, tone: "bg-success/15 text-success" },
  all: { icon: Layers, tone: "bg-vega-purple-soft text-[#c4b5fd]" },
} satisfies Record<(typeof views)[number], { icon: typeof CalendarDays; tone: string }>;
const statuses = ["all", "scheduled", "missed", "completed", "cancelled"] as const;
const priorities = ["all", "low", "medium", "high", "urgent"] as const;
const channels = ["all", "call", "whatsapp", "email", "meeting", "other"] as const;
const outcomes = [
  "no_answer",
  "not_picking_call",
  "call_back_later",
  "interested",
  "not_interested",
  "wrong_number",
  "qualified",
  "proposal_requested",
  "other",
] as const;

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("en-IN");
}

function badgeVariant(value: string): "danger" | "warning" | "success" | "accent" | "neutral" {
  if (value === "completed" || value === "interested" || value === "qualified") return "success";
  if (value === "urgent" || value === "missed" || value === "wrong_number") return "danger";
  if (value === "high" || value === "call_back_later" || value === "not_picking_call") return "warning";
  if (value === "scheduled" || value === "whatsapp" || value === "meeting") return "accent";
  return "neutral";
}

function leadTitle(lead: LeadRef) {
  if (!lead || typeof lead === "string") return "Unknown lead";
  return lead.title || "Untitled lead";
}

function leadIdValue(lead: LeadRef) {
  if (!lead) return "";
  return typeof lead === "string" ? lead : lead._id;
}

function assigneeName(actor?: UserRef) {
  if (!actor || typeof actor === "string") return "Unassigned";
  return actor.fullName || actor.email || "Unassigned";
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function FollowUpsWorkspace({ followUps }: { followUps: FollowUpsWorkspaceItem[] }) {
  const router = useRouter();
  const [view, setView] = useState<(typeof views)[number]>("all");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [channel, setChannel] = useState("all");
  const [outcomeById, setOutcomeById] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [nowTime] = useState(() => Date.now());
  const now = useMemo(() => new Date(nowTime), [nowTime]);

  const counts = useMemo(() => {
    const open = followUps.filter((item) => item.status !== "completed" && item.status !== "cancelled");
    return {
      open: open.length,
      overdue: open.filter((item) => new Date(item.dueAt).getTime() < now.getTime()).length,
      today: open.filter((item) => isSameDay(new Date(item.dueAt), now)).length,
      upcoming: open.filter((item) => new Date(item.dueAt).getTime() > now.getTime()).length,
      completed: followUps.filter((item) => item.status === "completed").length,
      all: followUps.length,
    };
  }, [followUps, now]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return followUps
      .filter((item) => {
        const due = new Date(item.dueAt);
        const isClosed = item.status === "completed" || item.status === "cancelled";
        if (view === "open" && isClosed) return false;
        if (view === "overdue" && (isClosed || due.getTime() >= now.getTime())) return false;
        if (view === "today" && (isClosed || !isSameDay(due, now))) return false;
        if (view === "upcoming" && (isClosed || due.getTime() <= now.getTime())) return false;
        if (view === "completed" && item.status !== "completed") return false;
        if (status !== "all" && item.status !== status) return false;
        if (priority !== "all" && item.priority !== priority) return false;
        if (channel !== "all" && item.channel !== channel) return false;
        if (!normalized) return true;
        const lead = typeof item.leadId === "string" ? null : item.leadId;
        return [
          item.nextAction,
          item.notes,
          item.outcome,
          lead?.title,
          lead?.contactName,
          lead?.email,
          lead?.phone,
        ].some((value) => String(value ?? "").toLowerCase().includes(normalized));
      })
      .sort((a, b) => {
        const aClosed = a.status === "completed" || a.status === "cancelled";
        const bClosed = b.status === "completed" || b.status === "cancelled";
        if (aClosed !== bClosed) return aClosed ? 1 : -1;
        return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      });
  }, [channel, followUps, now, priority, query, status, view]);

  async function complete(id: string) {
    setBusy(id);
    try {
      const response = await fetch(`/api/follow-ups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed", outcome: outcomeById[id] ?? "no_answer" }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data?.error?.message ?? "Update failed");
      router.refresh();
    } finally {
      setBusy("");
    }
  }

  const selectClass =
    "h-10 rounded-md border border-border bg-vega-surface-1 px-3 text-sm text-foreground outline-none transition focus:border-accent";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {views.map((item) => {
          const Icon = viewMeta[item].icon;

          return (
            <button
              key={item}
              type="button"
              onClick={() => setView(item)}
              className={`flex items-center gap-3 rounded-md border p-3 text-left transition ${
                view === item
                  ? "border-accent bg-accent/10 text-accent-strong"
                  : "border-border bg-vega-surface-1 text-muted-foreground hover:border-accent/40"
              }`}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${viewMeta[item].tone}`}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-medium uppercase">{humanize(item)}</span>
                <span className="mt-1 block text-2xl font-semibold">{counts[item]}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 rounded-md border border-border bg-vega-surface-2 p-3 lg:grid-cols-[minmax(220px,1fr)_repeat(3,180px)]">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search lead, phone, email, action..." className="h-10" />
        <select value={status} onChange={(event) => setStatus(event.target.value)} className={selectClass}>
          {statuses.map((item) => <option key={item} value={item}>{item === "all" ? "All statuses" : humanize(item)}</option>)}
        </select>
        <select value={priority} onChange={(event) => setPriority(event.target.value)} className={selectClass}>
          {priorities.map((item) => <option key={item} value={item}>{item === "all" ? "All priority" : humanize(item)}</option>)}
        </select>
        <select value={channel} onChange={(event) => setChannel(event.target.value)} className={selectClass}>
          {channels.map((item) => <option key={item} value={item}>{item === "all" ? "All channels" : humanize(item)}</option>)}
        </select>
      </div>

      <div className="space-y-3">
        {filtered.map((item) => {
          const leadId = leadIdValue(item.leadId);
          return (
            <article key={item._id} className="rounded-md border border-border bg-vega-surface-1 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={badgeVariant(item.status)}>{humanize(item.status)}</Badge>
                    <Badge variant={badgeVariant(item.priority)}>{humanize(item.priority)}</Badge>
                    <Badge variant={badgeVariant(item.channel)}>{humanize(item.channel)}</Badge>
                  </div>
                  <h3 className="mt-2 text-base font-semibold text-vega-text">
                    {leadId ? <Link href={`/leads/${leadId}`} className="hover:underline">{leadTitle(item.leadId)}</Link> : leadTitle(item.leadId)}
                  </h3>
                  <p className="mt-1 text-sm text-vega-text-secondary">{item.nextAction}</p>
                  <p className="mt-1 text-xs text-vega-text-muted">
                    Due {formatDateTime(item.dueAt)} / Assigned to {assigneeName(item.assignedToUserId)}
                  </p>
                  {item.notes ? <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-vega-text-muted">{item.notes}</p> : null}
                  {item.status === "completed" && item.outcome ? (
                    <div className="mt-3 rounded-md border border-success/30 bg-success/10 p-2 text-xs text-vega-text-secondary">
                      <span className="font-semibold text-success">Outcome: {humanize(item.outcome)}</span>
                      {item.outcomeNote ? (
                        <p className="mt-1 whitespace-pre-wrap leading-5 text-vega-text-muted">{item.outcomeNote}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {item.status !== "completed" && item.status !== "cancelled" ? (
                  <div className="grid min-w-[260px] gap-2">
                    <select value={outcomeById[item._id] ?? "no_answer"} onChange={(event) => setOutcomeById((value) => ({ ...value, [item._id]: event.target.value }))} className={selectClass}>
                      {outcomes.map((outcome) => <option key={outcome} value={outcome}>{humanize(outcome)}</option>)}
                    </select>
                    <Button variant="secondary" disabled={busy === item._id} onClick={() => void complete(item._id)}>
                      {busy === item._id ? "Updating..." : "Mark Complete"}
                    </Button>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-surface-soft/70 p-6 text-center text-sm text-muted-foreground">
          No follow-ups match this view.
        </div>
      ) : null}
    </div>
  );
}
