"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckCircle2, Clock3, MoreVertical, Phone, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type UserRef = string | { fullName?: string; email?: string; role?: string } | null;

export type LeadFollowUpItem = {
  _id: string;
  leadId: string;
  status: string;
  channel: string;
  priority: string;
  dueAt: string;
  nextAction: string;
  notes?: string;
  outcome?: string | null;
  outcomeNote?: string;
  completedAt?: string | null;
  assignedToUserId?: UserRef;
  createdById?: UserRef;
};

const channels = ["call", "whatsapp", "email", "meeting", "other"] as const;
const priorities = ["low", "medium", "high", "urgent"] as const;
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

function datetimeLocalValue(value?: string) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const offsetMs = parsed.getTimezoneOffset() * 60 * 1000;
  return new Date(parsed.getTime() - offsetMs).toISOString().slice(0, 16);
}

function badgeVariant(value: string): "danger" | "warning" | "success" | "accent" | "neutral" {
  if (value === "completed" || value === "interested" || value === "qualified") return "success";
  if (value === "urgent" || value === "missed" || value === "wrong_number") return "danger";
  if (value === "high" || value === "call_back_later" || value === "not_picking_call") return "warning";
  if (value === "scheduled" || value === "whatsapp" || value === "meeting") return "accent";
  return "neutral";
}

function followUpDotClass(value: string) {
  if (value === "completed") return "bg-success";
  if (value === "missed" || value === "urgent") return "bg-danger";
  if (value === "high" || value === "scheduled") return "bg-warning";
  return "bg-vega-purple";
}

function actorName(actor?: UserRef) {
  if (!actor || typeof actor === "string") return "Unassigned";
  return actor.fullName || actor.email || "Unassigned";
}

export function LeadFollowUpPanel({
  leadId,
  followUps,
}: {
  leadId: string;
  followUps: LeadFollowUpItem[];
}) {
  const router = useRouter();
  const [channel, setChannel] = useState("call");
  const [priority, setPriority] = useState("medium");
  const [dueAt, setDueAt] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [notes, setNotes] = useState("");
  const [outcomeById, setOutcomeById] = useState<Record<string, string>>({});
  const [outcomeNoteById, setOutcomeNoteById] = useState<Record<string, string>>({});
  const [rescheduleById, setRescheduleById] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [nowTime] = useState(() => Date.now());

  const openFollowUps = useMemo(
    () => followUps.filter((item) => item.status !== "completed" && item.status !== "cancelled"),
    [followUps],
  );
  const closedFollowUps = useMemo(
    () => followUps.filter((item) => item.status === "completed" || item.status === "cancelled"),
    [followUps],
  );
  const overdueCount = openFollowUps.filter((item) => new Date(item.dueAt).getTime() < nowTime).length;

  async function createFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dueAt || !nextAction.trim()) return;
    setBusy("create");
    setMessage("");

    try {
      const response = await fetch(`/api/leads/${leadId}/follow-ups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          priority,
          dueAt: new Date(dueAt).toISOString(),
          nextAction: nextAction.trim(),
          notes: notes.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Follow-up save failed");
      }

      setDueAt("");
      setNextAction("");
      setNotes("");
      setMessage("Follow-up scheduled.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Follow-up save failed");
    } finally {
      setBusy("");
    }
  }

  async function patchFollowUp(id: string, payload: Record<string, unknown>) {
    setBusy(id);
    setMessage("");

    try {
      const response = await fetch(`/api/follow-ups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Follow-up update failed");
      }
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Follow-up update failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-3">
      <form className="rounded-md border border-vega-border-soft bg-vega-surface-2 p-4" onSubmit={createFollowUp}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-vega-purple" aria-hidden="true" />
            <p className="text-base font-semibold text-vega-text">Follow-up Scheduler</p>
          </div>
          <p className="text-xs text-vega-text-muted">Schedule the next follow-up for this lead</p>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.1fr_0.8fr_1.3fr_1.8fr]">
          <label className="space-y-1">
            <span className="text-xs text-vega-text-muted">Action Type</span>
            <select value={channel} onChange={(event) => setChannel(event.target.value)} className="h-10 w-full rounded-md border border-vega-border bg-[#0b141f] px-3 text-sm text-vega-text">
              {channels.map((item) => (
                <option key={item} value={item}>{humanize(item)}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-vega-text-muted">Priority</span>
            <select value={priority} onChange={(event) => setPriority(event.target.value)} className="h-10 w-full rounded-md border border-vega-border bg-[#0b141f] px-3 text-sm text-vega-text">
              {priorities.map((item) => (
                <option key={item} value={item}>{humanize(item)}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-vega-text-muted">Date & Time</span>
            <Input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} required />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-vega-text-muted">Next Action</span>
            <Input value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="Next action..." maxLength={200} required />
          </label>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px] lg:items-end">
          <label className="space-y-1">
            <span className="text-xs text-vega-text-muted">Notes (optional)</span>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Context, last conversation, promise, objection..." rows={1} maxLength={2000} />
          </label>
          <Button type="submit" disabled={busy === "create" || !dueAt || !nextAction.trim()} className="h-10">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            {busy === "create" ? "Scheduling..." : "Schedule Follow-up"}
          </Button>
        </div>
        {message ? <p className="mt-2 text-xs text-vega-text-muted">{message}</p> : null}
      </form>

      <div className="rounded-md border border-vega-border-soft bg-vega-surface-1 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock3 className="h-5 w-5 text-vega-purple" aria-hidden="true" />
            <p className="text-base font-semibold text-vega-text">Upcoming & Recent Follow-ups</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="accent">Open {openFollowUps.length}</Badge>
            <Badge variant={overdueCount > 0 ? "danger" : "neutral"}>Overdue {overdueCount}</Badge>
            <Badge variant="success">Completed {closedFollowUps.length}</Badge>
          </div>
        </div>

        <div className="divide-y divide-vega-border-soft">
        {[...openFollowUps, ...closedFollowUps].map((item) => (
          <article key={item._id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 gap-3">
                <span
                  className={`mt-2 h-3 w-3 shrink-0 rounded-full ${followUpDotClass(item.status === "completed" ? item.status : item.priority)}`}
                  aria-hidden="true"
                />
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-vega-surface-2 text-vega-text-muted">
                  {item.status === "completed" ? (
                    <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
                  ) : (
                    <Phone className="h-4 w-4 text-blue-300" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={badgeVariant(item.status)}>{humanize(item.status)}</Badge>
                  <Badge variant={badgeVariant(item.priority)}>{humanize(item.priority)}</Badge>
                  <Badge variant={badgeVariant(item.channel)}>{humanize(item.channel)}</Badge>
                </div>
                <p className="mt-2 text-sm font-medium text-vega-text">{item.nextAction}</p>
                <p className="mt-1 text-xs text-vega-text-muted">
                  Due {formatDateTime(item.dueAt)} / Assigned to {actorName(item.assignedToUserId)}
                </p>
                {item.notes ? <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-vega-text-secondary">{item.notes}</p> : null}
                {item.outcome ? (
                  <p className="mt-2 text-xs text-vega-text-muted">
                    Outcome: {humanize(item.outcome)}
                    {item.outcomeNote ? ` / ${item.outcomeNote}` : ""}
                  </p>
                ) : null}
                </div>
              </div>
              <MoreVertical className="mt-1 h-4 w-4 text-vega-text-dim" aria-hidden="true" />
            </div>

            {item.status !== "completed" && item.status !== "cancelled" ? (
              <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_1fr_auto_auto]">
                <select value={outcomeById[item._id] ?? "no_answer"} onChange={(event) => setOutcomeById((value) => ({ ...value, [item._id]: event.target.value }))} className="h-[34px] rounded-md border border-vega-border bg-[#0b141f] px-3 text-xs text-vega-text">
                  {outcomes.map((outcome) => (
                    <option key={outcome} value={outcome}>{humanize(outcome)}</option>
                  ))}
                </select>
                <Input
                  value={outcomeNoteById[item._id] ?? ""}
                  onChange={(event) => setOutcomeNoteById((value) => ({ ...value, [item._id]: event.target.value }))}
                  placeholder="Outcome note"
                  maxLength={2000}
                />
                <Button
                  variant="secondary"
                  disabled={busy === item._id}
                  onClick={() =>
                    void patchFollowUp(item._id, {
                      status: "completed",
                      outcome: outcomeById[item._id] ?? "no_answer",
                      outcomeNote: outcomeNoteById[item._id] ?? "",
                    })
                  }
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Complete
                </Button>
                <Button variant="secondary" disabled={busy === item._id} onClick={() => void patchFollowUp(item._id, { status: "missed" })}>
                  Missed
                </Button>
              </div>
            ) : null}

            {item.status !== "completed" && item.status !== "cancelled" ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <Input
                  type="datetime-local"
                  value={rescheduleById[item._id] ?? datetimeLocalValue(item.dueAt)}
                  onChange={(event) => setRescheduleById((value) => ({ ...value, [item._id]: event.target.value }))}
                />
                <Button
                  variant="secondary"
                  disabled={busy === item._id || !rescheduleById[item._id]}
                  onClick={() => void patchFollowUp(item._id, { status: "scheduled", dueAt: new Date(rescheduleById[item._id]).toISOString() })}
                >
                  Reschedule
                </Button>
                <Button variant="danger" disabled={busy === item._id} onClick={() => void patchFollowUp(item._id, { status: "cancelled" })}>
                  Cancel
                </Button>
              </div>
            ) : null}
          </article>
        ))}
        </div>
      </div>

      {followUps.length === 0 ? (
        <div className="rounded-md border border-dashed border-vega-border-soft bg-vega-surface-2 p-4 text-sm text-vega-text-muted">
          No follow-ups scheduled yet.
        </div>
      ) : null}
    </div>
  );
}
