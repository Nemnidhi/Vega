"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
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
  const [showRevenue, setShowRevenue] = useState(false);
  const [revenue, setRevenue] = useState("");

  async function updateStatus(nextStatus: string, revenueAmount?: number) {
    if (nextStatus === status) return;
    if (nextStatus === "closed_won" && revenueAmount === undefined) {
      setRevenue(""); setError(""); setShowRevenue(true); return;
    }

    const previousStatus = status;
    setStatus(nextStatus);
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/leads/${leadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, ...(revenueAmount !== undefined ? { revenue: revenueAmount } : {}) }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Status update failed");
      }
      setShowRevenue(false);
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
      {showRevenue && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={(event) => event.stopPropagation()}>
          <form role="dialog" aria-modal="true" aria-label="Close deal and record revenue" className="w-full max-w-md space-y-4 rounded-xl border border-vega-border bg-vega-surface-1 p-5 shadow-xl"
            onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Escape" && !loading) setShowRevenue(false); }}
            onSubmit={(event) => { event.preventDefault(); if (revenue.trim()) void updateStatus("closed_won", Number(revenue)); }}>
            <h2 className="text-lg font-semibold text-vega-text">Close deal</h2>
            <p className="text-sm text-vega-text-muted">Enter revenue for this lead in INR. It will count towards monthly and yearly revenue targets for the assigned salesperson, plus one closed deal.</p>
            <label className="block text-sm text-vega-text">Revenue (₹)<input autoFocus required type="number" min="0" max="1000000000" step="0.01" value={revenue} disabled={loading} onChange={(event) => setRevenue(event.target.value)} className="mt-2 w-full rounded-lg border border-vega-border bg-vega-surface-2 px-3 py-2 text-vega-text" placeholder="Enter deal revenue" /></label>
            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
            <div className="flex justify-end gap-2"><button type="button" disabled={loading} onClick={() => setShowRevenue(false)} className="rounded-lg px-4 py-2 text-sm text-vega-text">Cancel</button><button type="submit" disabled={loading || !revenue.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">{loading ? "Saving…" : "Save & close deal"}</button></div>
          </form>
        </div>, document.body,
      )}
    </div>
  );
}
