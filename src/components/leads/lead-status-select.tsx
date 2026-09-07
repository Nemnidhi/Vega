"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const statusOptions = [
  "new",
  "contacted",
  "not_picking_call",
  "call_back_later",
  "follow_up",
  "interested",
  "not_interested",
  "qualified",
  "proposal_sent",
  "negotiation",
  "closed_won",
  "closed_lost",
  "wrong_number",
  "invalid",
] as const;

function statusLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

export function LeadStatusSelect({
  leadId,
  currentStatus,
  compact = false,
  className,
}: {
  leadId: string;
  currentStatus: string;
  compact?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function updateStatus(nextStatus: string) {
    if (nextStatus === status) return;

    const previousStatus = status;
    setStatus(nextStatus);
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/leads/${leadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Status update failed");
      }
      router.refresh();
    } catch (e) {
      setStatus(previousStatus);
      setError(e instanceof Error ? e.message : "Status update failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={cn("space-y-1", className)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <select
        value={status}
        disabled={loading}
        onChange={(event) => updateStatus(event.target.value)}
        className={cn(
          "rounded-md border border-border bg-vega-surface-1 text-sm text-foreground outline-none transition focus:border-accent disabled:cursor-wait disabled:opacity-70",
          compact ? "h-8 w-full min-w-0 px-2 text-xs" : "h-10 min-w-[11rem] px-3",
        )}
      >
        {statusOptions.map((option) => (
          <option key={option} value={option}>
            {statusLabel(option)}
          </option>
        ))}
      </select>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
