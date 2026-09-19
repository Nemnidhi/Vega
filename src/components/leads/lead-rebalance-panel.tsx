"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Preview = { total: number; moving: number; token: string; team: Array<{ id: string; fullName: string; before: number; after: number }> };
export function LeadRebalancePanel() {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function run(apply: boolean) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/leads/rebalance", apply ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: preview?.token }) } : { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) { setPreview(null); throw new Error(result.error?.message || "Could not rebalance leads"); }
      if (apply) {
        setPreview(null); router.refresh();
        setMessage(`${result.data.moved} leads reassigned.${result.data.skipped ? ` ${result.data.skipped} changed during rebalance; preview again to finish balancing.` : " Distribution updated."}`);
      } else setPreview(result.data);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not rebalance leads"); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3 rounded-xl border border-vega-border-soft bg-vega-surface-1 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-vega-text">Rebalance leads</h3>
      <p className="text-sm text-vega-text-muted">Divide all open leads equally across active salespeople. Closed, invalid, wrong-number and not-interested leads stay unchanged.</p></div>
      <button disabled={busy} onClick={() => run(false)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? "Please wait…" : "Preview rebalance"}</button></div>
    {preview && <div className="space-y-3"><p className="text-sm text-vega-text">{preview.total} open leads · {preview.team.length} salespeople · {preview.moving} assignments will change</p>
      {!preview.team.length ? <p className="text-sm text-vega-text-muted">Activate a salesperson before rebalancing.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm text-vega-text"><thead><tr><th className="p-2">Salesperson</th><th className="p-2">Current</th><th className="p-2">After rebalance</th></tr></thead><tbody>{preview.team.map((person) => <tr key={person.id}><td className="p-2">{person.fullName}</td><td className="p-2">{person.before}</td><td className="p-2">{person.after}</td></tr>)}</tbody></table></div>}
      {!!preview.team.length && !preview.moving && <p className="text-sm text-vega-text-muted">Leads are already balanced.</p>}
      <div className="flex gap-2"><button disabled={busy || !preview.moving || !preview.team.length} onClick={() => run(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">Confirm rebalance</button><button disabled={busy} onClick={() => setPreview(null)} className="px-4 py-2 text-sm text-vega-text">Cancel</button></div>
    </div>}
    {error && <p role="alert" className="text-sm text-red-500">{error}</p>}{message && <p role="status" className="text-sm text-green-600">{message}</p>}
  </div>;
}
