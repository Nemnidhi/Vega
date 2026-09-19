"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Person = { _id: string; fullName: string };
type AssignmentData = {
  currentOwnerId: string | null;
  lead: { ownerId: Person | null; assignmentHistory?: Array<{ _id: string; from: Person | null; to: Person | null; actorId: Person | null; method: string; at: string }> };
  salespeople: Person[];
};

export function LeadAssignmentPanel({ leadId, role }: { leadId: string; role: string }) {
  const router = useRouter();
  const [data, setData] = useState<AssignmentData | null>(null);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const fetchAssignment = useCallback(async (): Promise<AssignmentData> => {
    const response = await fetch(`/api/leads/${leadId}/assignment`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || "Could not load assignment");
    return result.data;
  }, [leadId]);
  function applyAssignment(value: AssignmentData) {
    setData(value);
    setSelected(value.lead.ownerId?._id || "");
  }
  async function load() { applyAssignment(await fetchAssignment()); }
  useEffect(() => {
    let cancelled = false;
    fetchAssignment().then((value) => { if (!cancelled) applyAssignment(value); })
      .catch((error: Error) => { if (!cancelled) setError(error.message); });
    return () => { cancelled = true; };
  }, [fetchAssignment]);

  async function assign() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/leads/${leadId}/assignment`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: selected, expectedOwnerId: data?.currentOwnerId || null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Assignment failed");
      if (role === "sales") { router.replace("/leads"); router.refresh(); return; }
      await load(); router.refresh(); setMessage("Lead assignment updated.");
    } catch (error) { setError(error instanceof Error ? error.message : "Assignment failed"); }
    finally { setBusy(false); }
  }

  return <div className="rounded-xl border border-vega-border-soft bg-vega-surface p-4 space-y-3">
    <div><h3 className="font-semibold text-vega-text">Lead assignment</h3>
      <p className="text-sm text-vega-text-muted">Assigned to: {data ? data.lead.ownerId?.fullName || "Unassigned" : "Loading..."}</p>
      <p className="text-xs text-vega-text-muted">New leads rotate equally across active salespeople.</p></div>
    {data && ["admin", "sales"].includes(role) && <div className="flex flex-wrap gap-2">
      <select aria-label="Assign lead to salesperson" value={selected} disabled={busy} onChange={(event) => setSelected(event.target.value)} className="min-w-0 rounded-lg border border-vega-border-soft bg-vega-surface p-2 text-sm text-vega-text">
        <option value="">Select salesperson</option>
        {data.salespeople.map((person) => <option key={person._id} value={person._id}>{person.fullName}</option>)}
      </select>
      <button type="button" onClick={assign} disabled={busy || !selected || selected === data.lead.ownerId?._id} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? "Saving..." : role === "admin" ? "Assign lead" : "Transfer lead"}</button>
      {!data.salespeople.length && <p className="text-sm text-vega-text-muted">No active salespeople. Activate a sales account to enable assignment.</p>}
    </div>}
    {error && <p role="alert" className="text-sm text-red-500">{error} <button type="button" onClick={() => { setError(""); load().catch((error: Error) => setError(error.message)); }} className="underline">Refresh assignment</button></p>}
    {message && <p role="status" className="text-sm text-green-600">{message}</p>}
    {!!data?.lead.assignmentHistory?.length && <details className="text-sm text-vega-text-muted"><summary className="cursor-pointer">Assignment history</summary>
      <ul className="mt-2 space-y-1">{[...data.lead.assignmentHistory].reverse().map((entry) => <li key={entry._id}>
        {entry.from?.fullName || "Unassigned"} {"->"} {entry.to?.fullName || "Removed user"} - {entry.actorId?.fullName || "Round robin"} - {new Date(entry.at).toLocaleString()}
      </li>)}</ul>
    </details>}
  </div>;
}
