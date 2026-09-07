"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
  List,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Search,
} from "lucide-react";
import { LeadStatusSelect } from "@/components/leads/lead-status-select";
import { Badge } from "@/components/ui/badge";
import {
  TIER_LABEL,
  TIER_ORDER,
  TIER_VARIANT,
  humanizeKey,
  isTier,
} from "@/lib/prospecting/tier-display";

type LeadRow = {
  _id: string;
  title: string;
  contactName?: string;
  email?: string;
  phone?: string;
  source: string;
  status: string;
  category?: string;
  urgency?: string;
  score?: number;
  priorityBand?: string;
  createdAt?: string;
  updatedAt?: string;
  prospecting?: {
    industry?: string;
    segment?: string;
    prospectingStatus?: string;
    classification?: { category?: string };
  } | null;
};

type TierFilter = "all" | "A" | "B" | "C" | "D" | "unclassified";
type SortOption = "updated_desc" | "updated_asc" | "score_desc" | "score_asc" | "title_asc";

const quickStatuses = ["all", "new", "contacted", "qualified", "closed_lost"] as const;
const leadStatuses = [
  "all",
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

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function tierOf(lead: LeadRow) {
  return lead.prospecting?.classification?.category;
}

function includesText(value: unknown, query: string) {
  return String(value ?? "").toLowerCase().includes(query);
}

function uniqueValues(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[])).sort((a, b) =>
    humanize(a).localeCompare(humanize(b)),
  );
}

function dateValue(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function initialsFor(lead: LeadRow) {
  const value = lead.contactName || lead.title;
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "LD";
}

function formatDateTime(value?: string) {
  const time = dateValue(value);
  if (time === null) return "-";
  return new Date(time).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusTabLabel(value: string) {
  if (value === "all") return "All";
  if (value === "closed_lost") return "Lost";
  return humanize(value);
}

function priorityLabel(lead: LeadRow) {
  if (lead.urgency) return humanize(lead.urgency);
  if (lead.priorityBand) return humanize(lead.priorityBand);
  return "Medium";
}

function priorityClass(lead: LeadRow) {
  const value = lead.urgency || lead.priorityBand || "medium";
  if (["critical", "high", "heavy_artillery"].includes(value)) {
    return "border-danger/30 bg-danger/15 text-danger";
  }
  if (["medium", "standard_sales", "volume_pipeline"].includes(value)) {
    return "border-warning/30 bg-warning/15 text-warning";
  }
  return "border-success/30 bg-success/15 text-success";
}

function industryLabel(lead: LeadRow) {
  if (lead.prospecting?.industry) return humanizeKey(lead.prospecting.industry);
  if (lead.category) return humanize(lead.category);
  return "";
}

function normalizePhoneForCall(phone?: string) {
  if (!phone) return "";
  return phone.replace(/[^\d+]/g, "").trim();
}

function normalizePhoneForWhatsApp(phone?: string) {
  if (!phone) return "";
  return phone.replace(/\D/g, "").trim();
}

export function LeadListWithStatusTabs({ leads }: { leads: LeadRow[] }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [minScore, setMinScore] = useState("");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("updated_desc");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [page, setPage] = useState(1);
  const [mobileVisibleCount, setMobileVisibleCount] = useState(4);

  const counts = useMemo(
    () =>
      quickStatuses.reduce(
        (result, status) => ({
          ...result,
          [status]:
            status === "all"
              ? leads.length
              : leads.filter((lead) => lead.status === status).length,
        }),
        {} as Record<(typeof quickStatuses)[number], number>,
      ),
    [leads],
  );

  // Only cold prospects carry an audit tier, so the tier filter is hidden
  // entirely on a board of purely inbound leads.
  const prospects = useMemo(() => leads.filter((lead) => Boolean(lead.prospecting)), [leads]);

  const tierCounts = useMemo(() => {
    const result: Record<string, number> = { unclassified: 0 };
    for (const tier of TIER_ORDER) result[tier] = 0;
    for (const lead of prospects) {
      const tier = tierOf(lead);
      if (isTier(tier)) result[tier] += 1;
      else result.unclassified += 1;
    }
    return result;
  }, [prospects]);

  const sourceOrder = useMemo(
    () => Array.from(new Set(leads.map((lead) => lead.source))).sort(),
    [leads],
  );

  const categoryOptions = useMemo(
    () => uniqueValues(leads.map((lead) => lead.category)),
    [leads],
  );
  const urgencyOptions = useMemo(
    () => uniqueValues(leads.map((lead) => lead.urgency)),
    [leads],
  );
  const priorityOptions = useMemo(
    () => uniqueValues(leads.map((lead) => lead.priorityBand)),
    [leads],
  );

  const filteredLeads = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const minScoreValue = minScore.trim() ? Number(minScore) : null;
    const fromTime = updatedFrom ? new Date(`${updatedFrom}T00:00:00`).getTime() : null;
    const toTime = updatedTo ? new Date(`${updatedTo}T23:59:59`).getTime() : null;

    let rows = statusFilter === "all" ? leads : leads.filter((lead) => lead.status === statusFilter);

    if (normalizedSearch) {
      rows = rows.filter((lead) =>
        [
          lead.title,
          lead.contactName,
          lead.email,
          lead.phone,
          lead.source,
          lead.status,
          lead.category,
          lead.urgency,
          lead.priorityBand,
          lead.prospecting?.industry,
          lead.prospecting?.segment,
        ].some((value) => includesText(value, normalizedSearch)),
      );
    }

    if (tierFilter !== "all") {
      rows = rows.filter((lead) => {
        const tier = tierOf(lead);
        if (tierFilter === "unclassified") return Boolean(lead.prospecting) && !isTier(tier);
        return tier === tierFilter;
      });
    }
    if (sourceFilter !== "all") {
      rows = rows.filter((lead) => lead.source === sourceFilter);
    }
    if (categoryFilter !== "all") {
      rows = rows.filter((lead) => lead.category === categoryFilter);
    }
    if (urgencyFilter !== "all") {
      rows = rows.filter((lead) => lead.urgency === urgencyFilter);
    }
    if (priorityFilter !== "all") {
      rows = rows.filter((lead) => lead.priorityBand === priorityFilter);
    }
    if (minScoreValue !== null && !Number.isNaN(minScoreValue)) {
      rows = rows.filter((lead) => (lead.score ?? 0) >= minScoreValue);
    }
    if (fromTime !== null || toTime !== null) {
      rows = rows.filter((lead) => {
        const time = dateValue(lead.updatedAt);
        if (time === null) return false;
        if (fromTime !== null && time < fromTime) return false;
        if (toTime !== null && time > toTime) return false;
        return true;
      });
    }

    return [...rows].sort((a, b) => {
      if (sortBy === "title_asc") return a.title.localeCompare(b.title);
      if (sortBy === "score_desc") return (b.score ?? 0) - (a.score ?? 0);
      if (sortBy === "score_asc") return (a.score ?? 0) - (b.score ?? 0);

      const aTime = dateValue(a.updatedAt) ?? 0;
      const bTime = dateValue(b.updatedAt) ?? 0;
      return sortBy === "updated_asc" ? aTime - bTime : bTime - aTime;
    });
  }, [
    categoryFilter,
    leads,
    minScore,
    priorityFilter,
    searchQuery,
    sortBy,
    sourceFilter,
    statusFilter,
    tierFilter,
    updatedFrom,
    updatedTo,
    urgencyFilter,
  ]);

  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filteredLeads.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleLeads = filteredLeads.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const mobileVisibleLeads = filteredLeads.slice(0, mobileVisibleCount);

  const hasAdvancedFilters =
    searchQuery.trim() ||
    categoryFilter !== "all" ||
    urgencyFilter !== "all" ||
    priorityFilter !== "all" ||
    minScore.trim() ||
    updatedFrom ||
    updatedTo ||
    sortBy !== "updated_desc";
  const activeFilterCount = [
    sourceFilter !== "all",
    categoryFilter !== "all",
    urgencyFilter !== "all",
    priorityFilter !== "all",
    tierFilter !== "all",
    Boolean(searchQuery.trim()),
    Boolean(minScore.trim()),
    Boolean(updatedFrom),
    Boolean(updatedTo),
  ].filter(Boolean).length;
  const mobileFilterBadge = Math.max(2, activeFilterCount);

  function resetFilters() {
    setStatusFilter("all");
    setTierFilter("all");
    setSourceFilter("all");
    setCategoryFilter("all");
    setUrgencyFilter("all");
    setPriorityFilter("all");
    setSearchQuery("");
    setMinScore("");
    setUpdatedFrom("");
    setUpdatedTo("");
    setSortBy("updated_desc");
    setShowAdvanced(false);
    setPage(1);
    setMobileVisibleCount(4);
  }

  const tabClass = (active: boolean) =>
    `rounded-md border px-4 py-2 text-sm font-medium transition ${
      active
        ? "border-vega-accent-border bg-vega-accent text-white"
        : "border-border bg-vega-surface-1 text-vega-text-secondary hover:border-accent/40 hover:text-vega-text"
    }`;
  const inputClass =
    "h-11 rounded-md border border-border bg-vega-surface-1 px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-accent";
  const selectClass = `${inputClass} cursor-pointer`;

  return (
    <div className="space-y-3">
      <div className="space-y-2.5 xl:hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_50px] gap-2">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vega-text-muted" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setPage(1);
                setMobileVisibleCount(4);
              }}
              placeholder="Search name, phone or company..."
              className={`${inputClass} h-10 rounded-lg pl-9 text-xs`}
            />
          </label>
          <button
            type="button"
            onClick={() => setShowAdvanced((value) => !value)}
            className="relative inline-flex h-10 items-center justify-center rounded-lg border border-border bg-vega-surface-1 text-vega-text-secondary"
            aria-label="Filters"
          >
            <Filter className="h-5 w-5" aria-hidden="true" />
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-vega-accent px-1 text-[10px] font-semibold text-white">
              {mobileFilterBadge}
            </span>
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {quickStatuses.slice(0, 4).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => {
                setStatusFilter(status);
                setPage(1);
                setMobileVisibleCount(4);
              }}
              className={`h-9 shrink-0 rounded-md border px-4 text-xs font-semibold ${
                statusFilter === status
                  ? "border-vega-accent bg-vega-accent text-white"
                  : "border-border bg-vega-surface-1 text-vega-text-secondary"
              }`}
            >
              {statusTabLabel(status)}
              {status === "all" ? (
                <span className="ml-1.5 rounded bg-white/10 px-1.5 py-0.5 text-[10px]">{counts[status]}</span>
              ) : null}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowAdvanced((value) => !value)}
            className="inline-flex h-9 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-vega-surface-1 text-vega-text-secondary"
            aria-label="More filters"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {showAdvanced ? (
          <div className="grid gap-3 rounded-lg border border-border bg-vega-surface-2 p-3">
            <select value={sourceFilter} onChange={(event) => { setSourceFilter(event.target.value); setMobileVisibleCount(4); }} className={selectClass}>
              <option value="all">All sources</option>
              {sourceOrder.map((source) => <option key={source} value={source}>{humanize(source)}</option>)}
            </select>
            <select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setMobileVisibleCount(4); }} className={selectClass}>
              <option value="all">All industries</option>
              {categoryOptions.map((category) => <option key={category} value={category}>{humanize(category)}</option>)}
            </select>
            <select value={priorityFilter} onChange={(event) => { setPriorityFilter(event.target.value); setMobileVisibleCount(4); }} className={selectClass}>
              <option value="all">All priority</option>
              {priorityOptions.map((priority) => <option key={priority} value={priority}>{humanize(priority)}</option>)}
            </select>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)} className={selectClass}>
              <option value="updated_desc">Recent activity</option>
              <option value="updated_asc">Oldest activity</option>
              <option value="score_desc">Highest score</option>
              <option value="score_asc">Lowest score</option>
              <option value="title_asc">Lead name A-Z</option>
            </select>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-vega-text-secondary">{filteredLeads.length} leads</p>
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortOption)}
              className="h-9 max-w-[150px] rounded-md border border-border bg-vega-surface-1 px-2.5 text-xs text-vega-text"
            >
              <option value="updated_desc">Recent activity</option>
              <option value="updated_asc">Oldest activity</option>
              <option value="score_desc">Highest score</option>
              <option value="title_asc">Lead name A-Z</option>
            </select>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-vega-surface-1 text-vega-text-secondary"
              aria-label="List view"
            >
              <List className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="space-y-2.5">
          {mobileVisibleLeads.map((lead) => {
            const leadHref = `/leads/${lead._id}`;
            const phoneForCall = normalizePhoneForCall(lead.phone);
            const phoneForWhatsApp = normalizePhoneForWhatsApp(lead.phone);
            return (
              <article
                key={lead._id}
                className="rounded-lg border border-border bg-vega-surface-1 p-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.16)]"
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => router.push(leadHref)}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-vega-surface-2 text-sm font-semibold text-vega-text-secondary">
                      {initialsFor(lead)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-vega-text">{lead.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-vega-text-muted">
                        {humanize(lead.source)}
                        {industryLabel(lead) ? ` - ${industryLabel(lead)}` : ""}
                      </span>
                    </span>
                  </button>
                  <MoreHorizontal className="mt-0.5 h-4 w-4 shrink-0 text-vega-text-muted" aria-hidden="true" />
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <LeadStatusSelect leadId={lead._id} currentStatus={lead.status} compact className="w-[122px] text-xs" />
                  <span className={`inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-semibold ${priorityClass(lead)}`}>
                    {priorityLabel(lead)}
                  </span>
                </div>

                <div className="mt-2.5 grid gap-2.5 border-b border-vega-border-soft pb-2.5 sm:grid-cols-[minmax(0,1fr)_180px]">
                  <p className="flex min-w-0 items-center gap-1.5 text-xs text-vega-text-muted">
                    <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">Last activity - {formatDateTime(lead.updatedAt)}</span>
                  </p>
                  <div className="flex items-center gap-2 text-xs text-vega-text-muted">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-vega-accent text-[11px] font-semibold text-white">SJ</span>
                    <span>Assigned to SJ</span>
                  </div>
                </div>

                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  <a
                    href={phoneForCall ? `tel:${phoneForCall}` : undefined}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-vega-surface-2 text-xs font-semibold text-vega-text"
                  >
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    Call
                  </a>
                  <a
                    href={phoneForWhatsApp ? `https://wa.me/${phoneForWhatsApp}` : undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-vega-surface-2 text-xs font-semibold text-vega-text"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    WhatsApp
                  </a>
                  <Link
                    href={leadHref}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-vega-surface-2 text-xs font-semibold text-vega-text"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    Open
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3 text-xs text-vega-text-muted">
          <p>Showing 1-{Math.min(mobileVisibleCount, filteredLeads.length)} of {filteredLeads.length}</p>
          {mobileVisibleCount < filteredLeads.length ? (
            <button
              type="button"
              onClick={() => setMobileVisibleCount((value) => value + 4)}
              className="inline-flex h-9 min-w-[150px] items-center justify-center gap-2 rounded-md border border-border bg-vega-surface-1 px-3 font-semibold text-vega-text"
            >
              Load more leads
              <ChevronRight className="h-4 w-4 rotate-90" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="hidden space-y-4 rounded-md border border-border bg-vega-surface-2 p-4 xl:block">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-3">
            {quickStatuses.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => {
                  setStatusFilter(status);
                  setPage(1);
                }}
                className={tabClass(statusFilter === status)}
              >
                {statusTabLabel(status)}
                <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-xs">{counts[status]}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-vega-surface-1 px-3 text-xs font-semibold text-vega-text-secondary hover:border-vega-accent-border hover:text-vega-text"
            >
              <Bookmark className="h-4 w-4" aria-hidden="true" />
              Save Filter
            </button>
            <button
              type="button"
              onClick={() => setShowAdvanced((value) => !value)}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-vega-surface-1 px-3 text-xs font-semibold text-vega-text-secondary hover:border-vega-accent-border hover:text-vega-text"
            >
              <Filter className="h-4 w-4" aria-hidden="true" />
              More Filters
            </button>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(280px,1.5fr)_repeat(4,minmax(150px,1fr))]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vega-text-muted" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search name, email, phone, company..."
              className={`${inputClass} pl-10`}
            />
          </label>
          <select
            value={sourceFilter}
            onChange={(event) => {
              setSourceFilter(event.target.value);
              setPage(1);
            }}
            className={selectClass}
          >
            <option value="all">All sources</option>
            {sourceOrder.map((source) => (
              <option key={source} value={source}>
                {humanize(source)}
              </option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value);
              setPage(1);
            }}
            className={selectClass}
          >
            <option value="all">All industries</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {humanize(category)}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className={selectClass}
          >
            {leadStatuses.map((status) => (
              <option key={status} value={status}>
                {status === "all" ? "All statuses" : humanize(status)}
              </option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(event) => {
              setPriorityFilter(event.target.value);
              setPage(1);
            }}
            className={selectClass}
          >
            <option value="all">All priority</option>
            {priorityOptions.map((priority) => (
              <option key={priority} value={priority}>
                {humanize(priority)}
              </option>
            ))}
          </select>
        </div>

        {showAdvanced ? (
          <div className="grid gap-3 border-t border-border pt-4 md:grid-cols-2 xl:grid-cols-6">
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortOption)}
            className={selectClass}
          >
            <option value="updated_desc">Latest updated</option>
            <option value="updated_asc">Oldest updated</option>
            <option value="score_desc">Highest score</option>
            <option value="score_asc">Lowest score</option>
            <option value="title_asc">Lead name A-Z</option>
          </select>
          <select
            value={urgencyFilter}
            onChange={(event) => {
              setUrgencyFilter(event.target.value);
              setPage(1);
            }}
            className={selectClass}
          >
            <option value="all">All urgency</option>
            {urgencyOptions.map((urgency) => (
              <option key={urgency} value={urgency}>
                {humanize(urgency)}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            value={minScore}
            onChange={(event) => setMinScore(event.target.value)}
            placeholder="Min score"
            className={inputClass}
          />
          <label className="relative xl:col-span-2">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vega-text-muted" aria-hidden="true" />
            <input
              type="date"
              value={updatedFrom}
              onChange={(event) => {
                setUpdatedFrom(event.target.value);
                setPage(1);
              }}
              className={`${inputClass} pl-10`}
              title="Updated from"
            />
          </label>
          <input
            type="date"
            value={updatedTo}
            onChange={(event) => {
              setUpdatedTo(event.target.value);
              setPage(1);
            }}
            className={inputClass}
            title="Updated to"
          />
        </div>
        ) : null}

        {prospects.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Tier</span>
            <button
              type="button"
              onClick={() => {
                setTierFilter("all");
                setPage(1);
              }}
              className={tabClass(tierFilter === "all")}
            >
              All {prospects.length}
            </button>
            {TIER_ORDER.map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => {
                  setTierFilter(tier);
                  setPage(1);
                }}
                className={tabClass(tierFilter === tier)}
                title={TIER_LABEL[tier]}
              >
                {tier} {tierCounts[tier]}
              </button>
            ))}
            {tierCounts.unclassified > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setTierFilter("unclassified");
                  setPage(1);
                }}
                className={tabClass(tierFilter === "unclassified")}
                title="Cold prospects with no classification yet"
              >
                Unclassified {tierCounts.unclassified}
              </button>
            ) : null}
          </div>
        ) : null}

        {hasAdvancedFilters || statusFilter !== "all" || tierFilter !== "all" || sourceFilter !== "all" ? (
          <button
            type="button"
            onClick={resetFilters}
            className="h-9 w-fit rounded-md border border-border bg-vega-surface-1 px-3 text-xs font-medium text-muted-foreground transition hover:border-accent/40 hover:text-foreground"
          >
            Reset filters
          </button>
        ) : null}
      </div>

      <div className="hidden overflow-hidden rounded-md border border-border bg-vega-surface-1 xl:block">
        <div className="overflow-x-auto">
        <table className="min-w-[1160px] w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-vega-surface-2 text-left text-xs font-semibold text-vega-text-muted">
              <th className="w-12 px-4 py-3">
                <input type="checkbox" className="h-4 w-4 rounded border-border bg-vega-surface-1" onClick={(event) => event.stopPropagation()} aria-label="Select all leads" />
              </th>
              <th className="w-12 px-2 py-3">#</th>
              <th className="px-2 py-3">Lead Details</th>
              <th className="px-2 py-3">Source</th>
              <th className="px-2 py-3">Industry</th>
              <th className="px-2 py-3">Tier</th>
              <th className="px-2 py-3">Status</th>
              <th className="px-2 py-3">Priority</th>
              <th className="px-2 py-3">Last Activity</th>
              <th className="px-2 py-3">Assigned To</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleLeads.map((lead, index) => {
              const tier = tierOf(lead);
              const leadHref = `/leads/${lead._id}`;
              return (
                <tr
                  key={lead._id}
                  role="link"
                  tabIndex={0}
                  aria-label={`Open ${lead.title}`}
                  onClick={() => router.push(leadHref)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(leadHref);
                    }
                  }}
                  className="cursor-pointer border-b border-border/70 transition-colors hover:bg-vega-surface-1/70 focus-visible:bg-vega-surface-1/70 focus-visible:outline-none"
                >
                  <td className="px-4 py-3">
                    <input type="checkbox" className="h-4 w-4 rounded border-border bg-vega-surface-1" onClick={(event) => event.stopPropagation()} aria-label={`Select ${lead.title}`} />
                  </td>
                  <td className="px-2 py-3 text-vega-text-secondary">{(currentPage - 1) * pageSize + index + 1}</td>
                  <td className="px-2 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-vega-surface-2 text-sm font-semibold text-vega-text-secondary">
                        {initialsFor(lead)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{lead.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[lead.email, lead.phone].filter(Boolean).join(" | ") ||
                            lead.contactName ||
                            (lead.prospecting ? "No contact sourced" : "-")}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <Badge variant="accent">{humanize(lead.source)}</Badge>
                  </td>
                  <td className="px-2 py-3">
                    {lead.prospecting?.industry ? (
                      <>
                        <p className="text-foreground">{humanizeKey(lead.prospecting.industry)}</p>
                        {lead.prospecting.segment ? (
                          <p className="text-xs text-muted-foreground">
                            {humanizeKey(lead.prospecting.segment)}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    {isTier(tier) ? (
                      <Badge variant={TIER_VARIANT[tier]} title={TIER_LABEL[tier]}>
                        {tier}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    <LeadStatusSelect
                      leadId={lead._id}
                      currentStatus={lead.status}
                      compact
                    />
                  </td>
                  <td className="px-2 py-3">
                    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${priorityClass(lead)}`}>
                      {priorityLabel(lead)}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-xs text-vega-text-secondary">
                    {formatDateTime(lead.updatedAt)}
                  </td>
                  <td className="px-2 py-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-vega-accent text-xs font-semibold text-white">
                      SJ
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link
                      href={leadHref}
                      prefetch={false}
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-vega-text-muted transition-colors hover:bg-vega-surface-hover hover:text-vega-text"
                      aria-label={`Open ${lead.title}`}
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-2 py-8 text-center text-muted-foreground">
                  No leads match this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        </div>
      </div>

      <div className="hidden flex-col gap-3 text-sm text-vega-text-muted sm:flex-row sm:items-center sm:justify-between xl:flex">
        <p>
          Showing {filteredLeads.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}-
          {Math.min(currentPage * pageSize, filteredLeads.length)} of {filteredLeads.length} leads
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={currentPage === 1}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-vega-surface-1 text-vega-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          {Array.from({ length: Math.min(pageCount, 5) }, (_, item) => item + 1).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setPage(item)}
              className={`h-10 min-w-10 rounded-md border px-3 text-sm font-semibold ${
                currentPage === item
                  ? "border-vega-accent bg-vega-accent text-white"
                  : "border-border bg-vega-surface-1 text-vega-text-secondary"
              }`}
            >
              {item}
            </button>
          ))}
          {pageCount > 6 ? <span className="px-1">...</span> : null}
          {pageCount > 5 ? (
            <button
              type="button"
              onClick={() => setPage(pageCount)}
              className={`h-10 min-w-10 rounded-md border px-3 text-sm font-semibold ${
                currentPage === pageCount
                  ? "border-vega-accent bg-vega-accent text-white"
                  : "border-border bg-vega-surface-1 text-vega-text-secondary"
              }`}
            >
              {pageCount}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
            disabled={currentPage === pageCount}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-vega-surface-1 text-vega-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
