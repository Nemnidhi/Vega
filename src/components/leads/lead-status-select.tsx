"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const statusOptions = [
  "new",
  "contacted",
  "qualified",
  "proposal_sent",
  "negotiation",
  "closed_won",
  "closed_lost",
] as const;

function statusLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

export function LeadStatusSelect({
  leadId,
  currentStatus,
}: {
  leadId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function updateStatus(nextStatus: string) {
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
      setError(e instanceof Error ? e.message : "Status update failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <select
        value={status}
        disabled={loading}
        onChange={(event) => updateStatus(event.target.value)}
        className="h-10 min-w-[11rem] rounded-md border border-border bg-white px-3 text-sm"
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
