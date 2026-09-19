"use client";

import { useState, type FormEvent } from "react";
import { Target, TrendingUp, Trophy, Plus, Pencil, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Person = { _id: string; fullName: string; status?: string };
type TargetItem = {
  _id: string; assignedUserId: Person | null; metric: "revenue" | "deals";
  period: "monthly" | "yearly"; periodKey: string; target: number; achieved: number;
  notes: string; manualAchieved?: number; automaticAchieved?: number; version: number; updatedAt: string; updatedBy: Person | null;
};
export type SalesTargetsData = { targets: TargetItem[]; salespeople: Person[] };
type Form = { assignedUserId: string; metric: "revenue" | "deals"; period: "monthly" | "yearly"; periodKey: string; target: string; achieved: string; notes: string };
const inputClass = "mt-1 w-full rounded-lg border border-vega-border bg-vega-surface-1 px-3 py-2.5 text-sm text-vega-text outline-none focus:border-vega-accent";
function amount(value: number, metric: string) {
  return metric === "revenue" ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value) : `${value.toLocaleString("en-IN")} deals`;
}
function periodLabel(item: Pick<TargetItem, "period" | "periodKey">) {
  return item.period === "yearly" ? `Year ${item.periodKey}` : new Date(`${item.periodKey}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function SalesTargetsWorkspace({ initialData, isAdmin, currentMonth }: { initialData: SalesTargetsData; isAdmin: boolean; currentMonth: string }) {
  const [data, setData] = useState(initialData);
  const [editing, setEditing] = useState<TargetItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const emptyForm: Form = { assignedUserId: "", metric: "revenue", period: "monthly", periodKey: currentMonth, target: "", achieved: "0", notes: "" };
  const [form, setForm] = useState<Form>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [personFilter, setPersonFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const people = Array.from(new Map([...data.salespeople, ...data.targets.flatMap((item) => item.assignedUserId ? [item.assignedUserId] : [])].map((person) => [person._id, person])).values());
  const years = Array.from(new Set(data.targets.map((item) => item.periodKey.slice(0, 4)))).sort().reverse();
  const filtered = data.targets.filter((item) => (periodFilter === "all" || item.period === periodFilter) && (personFilter === "all" || item.assignedUserId?._id === personFilter) && (yearFilter === "all" || item.periodKey.startsWith(yearFilter)));
  const achievedCount = filtered.filter((item) => item.achieved >= item.target).length;
  async function refresh() {
    const response = await fetch("/api/sales-targets", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || "Could not load targets");
    setData(result.data);
  }
  function openForm(item?: TargetItem) {
    setError(""); setMessage(""); setEditing(item || null); setShowForm(true);
    setForm(item ? { assignedUserId: item.assignedUserId?._id || "", metric: item.metric, period: item.period, periodKey: item.periodKey, target: String(item.target), achieved: String(item.manualAchieved ?? 0), notes: item.notes } : emptyForm);
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(editing ? `/api/sales-targets/${editing._id}` : "/api/sales-targets", {
        method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, target: Number(form.target), achieved: Number(form.achieved), ...(editing ? { version: editing.version } : {}) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Could not save target");
      setShowForm(false); setEditing(null); setMessage("Target saved.");
      await refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save target"); }
    finally { setBusy(false); }
  }
  return <section className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-vega-border-soft pb-4">
      <div><p className="text-xs text-vega-text-muted">Sales performance</p><h1 className="mt-1 text-2xl font-semibold text-vega-text">Sales Targets</h1>
        <p className="mt-1 text-sm text-vega-text-muted">{isAdmin ? "Assign monthly and yearly revenue or closed-deal targets to your sales team." : "Your monthly and yearly targets, with progress from your closed deals."}</p></div>
      <div className="flex gap-2"><Button variant="secondary" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await refresh(); } catch (error) { setError(error instanceof Error ? error.message : "Refresh failed"); } finally { setBusy(false); } }}><RefreshCw className="h-4 w-4" />Refresh</Button>
        {isAdmin && <Button disabled={busy} onClick={() => openForm()}><Plus className="h-4 w-4" />Assign target</Button>}</div>
    </header>
    {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}
    {message && <p role="status" className="text-sm text-green-500">{message}</p>}
    {showForm && isAdmin && <form onSubmit={save} className="space-y-4 rounded-xl border border-vega-accent/40 bg-vega-surface-1 p-4 sm:p-5">
      <div><h2 className="font-semibold text-vega-text">{editing ? "Edit target and progress" : "Assign a sales target"}</h2><p className="mt-1 text-xs text-vega-text-muted">Closed deals update progress automatically. Use an opening adjustment only for revenue/deals not recorded through lead closure. Yearly targets use the calendar year.</p></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm text-vega-text-secondary">Salesperson<select required disabled={!!editing || busy} className={inputClass} value={form.assignedUserId} onChange={(event) => setForm({ ...form, assignedUserId: event.target.value })}>
          <option value="">Select salesperson</option>{(editing ? people : data.salespeople).map((person) => <option value={person._id} key={person._id}>{person.fullName}</option>)}
        </select></label>
        <label className="text-sm text-vega-text-secondary">Target type<select className={inputClass} disabled={busy} value={form.metric} onChange={(event) => setForm({ ...form, metric: event.target.value as Form["metric"] })}><option value="revenue">Revenue (â‚¹)</option><option value="deals">Closed deals</option></select></label>
        <label className="text-sm text-vega-text-secondary">Period<select className={inputClass} disabled={busy} value={form.period} onChange={(event) => { const period = event.target.value as Form["period"]; setForm({ ...form, period, periodKey: period === "yearly" ? form.periodKey.slice(0, 4) : `${form.periodKey.slice(0, 4)}-${currentMonth.slice(5)}` }); }}><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label>
        <label className="text-sm text-vega-text-secondary">{form.period === "monthly" ? "Month" : "Calendar year"}<input required disabled={busy} className={inputClass} type={form.period === "monthly" ? "month" : "number"} min={form.period === "monthly" ? "2000-01" : "2000"} max={form.period === "monthly" ? "2099-12" : "2099"} value={form.periodKey} onChange={(event) => setForm({ ...form, periodKey: event.target.value })} /></label>
        <label className="text-sm text-vega-text-secondary">{form.metric === "revenue" ? "Target revenue (â‚¹)" : "Target closed deals"}<input required disabled={busy} className={inputClass} type="number" min={form.metric === "revenue" ? "0.01" : "1"} step={form.metric === "revenue" ? "0.01" : "1"} value={form.target} onChange={(event) => setForm({ ...form, target: event.target.value })} /></label>
        <label className="text-sm text-vega-text-secondary">{form.metric === "revenue" ? "Achieved revenue (â‚¹)" : "Achieved closed deals"}<input required disabled={busy} className={inputClass} type="number" min="0" step={form.metric === "revenue" ? "0.01" : "1"} value={form.achieved} onChange={(event) => setForm({ ...form, achieved: event.target.value })} /></label>
      </div>
      <label className="block text-sm text-vega-text-secondary">Notes<textarea disabled={busy} maxLength={1000} rows={2} className={inputClass} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Expectation, context or progress update" /></label>
      {!editing && !data.salespeople.length && <p className="text-sm text-amber-500">No active salespeople. Activate a sales account before assigning a target.</p>}
      <div className="flex gap-2"><Button type="submit" disabled={busy || (!editing && !data.salespeople.length)}>{busy ? "Savingâ€¦" : "Save target"}</Button><Button type="button" variant="secondary" disabled={busy} onClick={() => setShowForm(false)}>Cancel</Button></div>
    </form>}
    <div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-vega-border-soft bg-vega-surface-1 p-4"><Target className="mb-2 h-5 w-5 text-vega-accent" /><p className="text-2xl font-semibold text-vega-text">{filtered.length}</p><p className="text-xs text-vega-text-muted">Targets in view</p></div><div className="rounded-xl border border-vega-border-soft bg-vega-surface-1 p-4"><Trophy className="mb-2 h-5 w-5 text-green-500" /><p className="text-2xl font-semibold text-vega-text">{achievedCount}</p><p className="text-xs text-vega-text-muted">Targets achieved</p></div></div>
    <div className="flex flex-wrap gap-3">
      {isAdmin && <select aria-label="Filter by salesperson" className={`${inputClass} sm:w-auto`} value={personFilter} onChange={(event) => setPersonFilter(event.target.value)}><option value="all">All salespeople</option>{people.map((person) => <option key={person._id} value={person._id}>{person.fullName}</option>)}</select>}
      <select aria-label="Filter target period" className={`${inputClass} sm:w-auto`} value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)}><option value="all">Monthly and yearly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select>
      <select aria-label="Filter target year" className={`${inputClass} sm:w-auto`} value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}><option value="all">All years</option>{years.map((year) => <option key={year}>{year}</option>)}</select>
    </div>
    {!filtered.length ? <div className="rounded-xl border border-dashed border-vega-border p-10 text-center"><Target className="mx-auto mb-3 h-8 w-8 text-vega-text-muted" /><h2 className="font-semibold text-vega-text">No targets to show</h2><p className="mt-1 text-sm text-vega-text-muted">{data.targets.length ? "Try changing the filters." : isAdmin ? "Assign the first monthly or yearly target to a salesperson." : "Your admin has not assigned a sales target yet."}</p></div> :
      <div className="grid gap-4 lg:grid-cols-2">{filtered.map((item) => {
        const percentage = Math.round(item.achieved / item.target * 100);
        const met = item.achieved >= item.target;
        return <article key={item._id} className="space-y-4 rounded-xl border border-vega-border-soft bg-vega-surface-1 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-vega-accent">{periodLabel(item)} Â· {item.period === "monthly" ? "Monthly" : "Yearly"}</p><h2 className="mt-1 font-semibold text-vega-text">{item.metric === "revenue" ? "Revenue target" : "Closed deals target"}</h2>{isAdmin && <p className="mt-1 text-sm text-vega-text-secondary">{item.assignedUserId?.fullName || "Removed salesperson"}</p>}</div>
            {isAdmin && <button type="button" disabled={busy} aria-label={`Edit ${item.assignedUserId?.fullName || "salesperson"} ${item.metric} target for ${item.periodKey}`} onClick={() => openForm(item)} className="rounded-lg p-2 text-vega-text-muted hover:bg-vega-surface-2"><Pencil className="h-4 w-4" /></button>}</div>
          <div className="flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs text-vega-text-muted">Achieved</p><p className="text-2xl font-semibold text-vega-text">{amount(item.achieved, item.metric)}</p><p className="text-sm text-vega-text-muted">of {amount(item.target, item.metric)}</p></div><span className={`rounded-full px-3 py-1 text-xs font-medium ${met ? "bg-green-500/10 text-green-500" : "bg-vega-accent-soft text-vega-accent"}`}>{met ? "Target achieved" : `${percentage}% complete`}</span></div>
          <div role="progressbar" aria-label={`${item.metric} target progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, percentage)} aria-valuetext={`${percentage}% achieved`} className="h-2 overflow-hidden rounded-full bg-vega-surface-2"><div className={`h-full rounded-full ${met ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${Math.min(100, percentage)}%` }} /></div>
          <p className="flex items-center gap-2 text-xs text-vega-text-muted"><TrendingUp className="h-4 w-4" />{met ? `${amount(item.achieved - item.target, item.metric)} above target` : `${amount(item.target - item.achieved, item.metric)} remaining`}</p>
          {item.notes && <p className="whitespace-pre-wrap break-words text-sm text-vega-text-secondary">{item.notes}</p>}
          <p className="text-xs text-vega-text-muted">From closed leads: {amount(item.automaticAchieved ?? 0, item.metric)} ? Opening adjustment: {amount(item.manualAchieved ?? 0, item.metric)}</p>
          <p className="border-t border-vega-border-soft pt-3 text-xs text-vega-text-muted">Admin-entered progress Â· Updated {new Date(item.updatedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}{isAdmin && item.updatedBy?.fullName ? ` by ${item.updatedBy.fullName}` : ""}</p>
        </article>;
      })}</div>}
  </section>;
}
