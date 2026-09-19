"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { canonicalTaskStatuses, normalizeTaskStatus, type CanonicalTaskStatus } from "@/lib/tasks/status";
import { humanize, statusTone } from "@/lib/tasks/tone";
import { cn } from "@/lib/utils/cn";

/**
 * Status control on the task header.
 *
 * Status was a read-only badge here, so moving a task along meant opening a
 * subtask drawer or editing elsewhere. Changing it posts to the task PATCH
 * route, which is also what notifies the admins.
 */
export function TaskStatusSelect({
  taskId,
  currentStatus,
  className,
}: {
  taskId: string;
  currentStatus: string;
  className?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(() => normalizeTaskStatus(currentStatus));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function updateStatus(next: CanonicalTaskStatus) {
    if (next === status) return;
    const previous = status;
    // Optimistic: the badge colour should move the moment it is picked, or the
    // control feels unresponsive while the request is in flight.
    setStatus(next);
    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload?.error?.message ?? "Could not update the status.");
      }
      router.refresh();
    } catch (e) {
      setStatus(previous);
      setError(e instanceof Error ? e.message : "Could not update the status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cn("relative", className)}>
      <select
        value={status}
        disabled={saving}
        onChange={(event) => void updateStatus(event.target.value as CanonicalTaskStatus)}
        aria-label="Task status"
        title={error || "Change task status"}
        className={cn(
          "h-[22px] cursor-pointer appearance-none rounded-md border pl-2 pr-6 text-[10px] font-medium outline-none transition",
          "focus:border-vega-accent disabled:cursor-wait disabled:opacity-60",
          statusTone(status),
        )}
      >
        {canonicalTaskStatuses.map((value) => (
          <option key={value} value={value} className="bg-vega-surface-1 text-vega-text">
            {humanize(value)}
          </option>
        ))}
      </select>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] text-current opacity-70"
      >
        ▼
      </span>
      {error ? <p className="mt-1 text-[10px] text-vega-red">{error}</p> : null}
    </div>
  );
}
