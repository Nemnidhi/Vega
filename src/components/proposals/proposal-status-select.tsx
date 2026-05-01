"use client";

import { useState } from "react";

const statusOptions = [
  "draft",
  "generated",
  "sent",
  "viewed",
  "signed",
  "rejected",
] as const;

export function ProposalStatusSelect({
  proposalId,
  currentStatus,
}: {
  proposalId: string;
  currentStatus: string;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function updateStatus(nextStatus: string) {
    setStatus(nextStatus);
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/proposals/${proposalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Failed to update proposal status");
      }
      window.location.reload();
    } catch (errorValue) {
      setError(
        errorValue instanceof Error
          ? errorValue.message
          : "Failed to update proposal status",
      );
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
        className="h-10 rounded-md border border-border bg-white px-2 text-sm"
      >
        {statusOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
