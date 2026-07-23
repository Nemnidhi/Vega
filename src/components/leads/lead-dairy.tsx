"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type LeadDairyNote = {
  _id: string;
  note: string;
  createdAt?: string;
  createdById?: string | { fullName?: string; email?: string; role?: string } | null;
};

function formatDateTime(value?: string) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("en-IN");
}

function formatActor(actor?: LeadDairyNote["createdById"]) {
  if (!actor || typeof actor === "string") return "System";
  return actor.fullName || actor.email || "System";
}

export function LeadDairy({
  leadId,
  notes,
}: {
  leadId: string;
  notes: LeadDairyNote[];
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const canSubmit = note.trim().length > 0 && note.trim().length <= 2000;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/leads/${leadId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Note save failed");
      }

      setNote("");
      setMessage("Note added.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Note save failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <form className="space-y-3" onSubmit={submit}>
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Add lead note..."
          rows={4}
          maxLength={2000}
          required
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{note.trim().length}/2000</p>
          <Button type="submit" disabled={!canSubmit || loading}>
            {loading ? "Saving..." : "Add Note"}
          </Button>
        </div>
        {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      </form>

      {notes.length ? (
        <div className="space-y-3">
          {notes.map((item) => (
            <article key={item._id} className="rounded-lg border border-border bg-white p-3">
              <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{item.note}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>By {formatActor(item.createdById)}</span>
                <span>{formatDateTime(item.createdAt)}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-surface-soft/70 p-4 text-sm text-muted-foreground">
          No lead dairy notes yet.
        </div>
      )}
    </div>
  );
}
