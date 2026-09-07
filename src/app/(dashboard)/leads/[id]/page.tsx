import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  Edit3,
  ExternalLink,
  FileCheck2,
  FileText,
  Globe2,
  Mail,
  NotebookText,
  Pencil,
  Phone,
  User,
  Users,
  Zap,
} from "lucide-react";
import { LeadDairy } from "@/components/leads/lead-dairy";
import { LeadFollowUpPanel, type LeadFollowUpItem } from "@/components/leads/lead-follow-up-panel";
import { LeadStatusSelect } from "@/components/leads/lead-status-select";
import { LeadFieldsEditor } from "@/components/leads/lead-fields-editor";
import { AuditReportPanel } from "@/components/leads/audit-report-panel";
import { ClientInvitePanel, type ClientInvitePanelProps } from "@/components/leads/client-invite-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { connectToDatabase } from "@/lib/db/mongodb";
import {
  BlueprintModel,
  ClientModel,
  ClientInviteModel,
  LeadModel,
  LeadFollowUpModel,
  LeadNoteModel,
  ProposalModel,
  ScopeManifestModel,
  UserModel,
} from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";
import { requireRoleAccess } from "@/lib/auth/role-access";
import type { LeadProspecting } from "@/types/lead";

export const dynamic = "force-dynamic";

function priorityVariant(priorityBand: string): "danger" | "warning" | "accent" | "neutral" {
  if (priorityBand === "heavy_artillery") return "danger";
  if (priorityBand === "standard_sales") return "warning";
  if (priorityBand === "volume_pipeline") return "accent";
  return "neutral";
}

function urgencyVariant(urgency: string): "danger" | "warning" | "accent" | "neutral" {
  if (urgency === "critical") return "danger";
  if (urgency === "high") return "warning";
  if (urgency === "medium") return "accent";
  return "neutral";
}

function statusVariant(status: string): "danger" | "warning" | "success" | "accent" | "neutral" {
  if (status === "closed_lost" || status === "wrong_number" || status === "invalid") return "danger";
  if (status === "closed_won" || status === "interested") return "success";
  if (
    status === "proposal_sent" ||
    status === "negotiation" ||
    status === "not_picking_call" ||
    status === "call_back_later" ||
    status === "follow_up"
  ) {
    return "warning";
  }
  if (status === "qualified") return "accent";
  return "neutral";
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function normalizePhoneForCall(phone?: string) {
  if (!phone) return "";
  return phone.replace(/[^\d+]/g, "").trim();
}

function normalizePhoneForWhatsApp(phone?: string) {
  if (!phone) return "";
  return phone.replace(/\D/g, "").trim();
}

function extractPhoneFromDescription(description?: string) {
  if (!description) return "";
  const directMatch = description.match(
    /(?:mobile|phone)\s*:\s*(\+?\d[\d\s\-()]{6,}\d)/i,
  );
  if (directMatch?.[1]) {
    return directMatch[1].trim();
  }

  const fallbackMatch = description.match(/(\+?\d[\d\s\-()]{6,}\d)/);
  return fallbackMatch?.[1]?.trim() || "";
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("en-IN");
}

function formatBudget(budget?: { min: number; max: number; currency: string }) {
  if (!budget) return "Not shared";
  return `${budget.currency} ${budget.min.toLocaleString("en-IN")} - ${budget.max.toLocaleString(
    "en-IN",
  )}`;
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.36 1.89.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.92.34 1.85.58 2.81.7A2 2 0 0 1 22 16.92Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M20.52 3.48A11.92 11.92 0 0 0 12.04 0C5.43 0 .05 5.38.04 12a11.9 11.9 0 0 0 1.6 5.97L0 24l6.2-1.62A11.95 11.95 0 0 0 12.04 24h.01c6.61 0 11.99-5.38 12-12a11.9 11.9 0 0 0-3.53-8.52Zm-8.48 18.5h-.01a10 10 0 0 1-5.1-1.4l-.37-.22-3.68.96.98-3.59-.24-.37A9.96 9.96 0 0 1 2.05 12c0-5.5 4.48-9.98 9.99-9.98 2.67 0 5.18 1.04 7.06 2.92A9.93 9.93 0 0 1 22 12c0 5.51-4.48 9.98-9.96 9.98Z"
        fill="currentColor"
      />
      <path
        d="M17.46 14.41c-.29-.15-1.72-.84-1.99-.94-.26-.1-.45-.15-.64.15-.19.29-.74.94-.91 1.14-.17.19-.34.22-.63.07-.29-.15-1.2-.44-2.29-1.42-.85-.76-1.42-1.7-1.59-1.99-.17-.29-.02-.45.13-.6.13-.13.29-.34.44-.52.15-.17.19-.29.29-.49.1-.19.05-.37-.02-.52-.07-.15-.64-1.54-.88-2.11-.23-.56-.46-.48-.64-.49-.17-.01-.37-.01-.57-.01-.19 0-.52.07-.79.37-.27.29-1.04 1.01-1.04 2.45s1.07 2.83 1.22 3.03c.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.69.63.71.23 1.35.2 1.86.12.57-.08 1.72-.7 1.97-1.38.24-.68.24-1.27.17-1.39-.08-.12-.27-.2-.56-.34Z"
        fill="currentColor"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <rect x="3" y="5" width="18" height="14" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M3.8 7.2 12 13l8.2-5.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Params = Promise<{ id: string }>;

export default async function LeadDetailPage({ params }: { params: Params }) {
  await requireRoleAccess(["admin", "sales", "digital_marketing"]);

  const { id } = await params;
  await connectToDatabase();

  const leadDoc = await LeadModel.findById(id)
    .select(
      "title contactName email phone source sourceDomain sourcePath sourceReferrer category urgency score priorityBand priorityFlag status description budget tags prospecting createdAt updatedAt",
    )
    .lean();

  if (!leadDoc) {
    notFound();
  }

  // contactName / email / category / urgency / description are optional on
  // cold_outreach leads - a prospect scraped from a public registry has a
  // business name and little else. Everything below has to tolerate that.
  const lead = serializeForJson(leadDoc) as {
    _id: string;
    title: string;
    contactName?: string;
    email?: string;
    phone?: string;
    source: string;
    sourceDomain?: string;
    sourcePath?: string;
    sourceReferrer?: string;
    category?: string;
    urgency?: string;
    score: number;
    priorityBand: string;
    priorityFlag: boolean;
    status: string;
    description?: string;
    budget?: { min: number; max: number; currency: string };
    tags?: string[];
    prospecting?: LeadProspecting;
    createdAt?: string;
    updatedAt?: string;
  };

  const noteDocs = await LeadNoteModel.find({ leadId: leadDoc._id })
    .sort({ createdAt: -1 })
    .limit(20)
    .select("note createdById createdAt")
    .populate("createdById", "fullName email role")
    .lean();

  const leadNotes = serializeForJson(noteDocs) as Array<{
    _id: string;
    note: string;
    createdById?: string | { fullName?: string; email?: string; role?: string } | null;
    createdAt?: string;
  }>;

  const followUpDocs = await LeadFollowUpModel.find({ leadId: leadDoc._id })
    .sort({ status: 1, dueAt: 1 })
    .limit(100)
    .select(
      "leadId status channel priority dueAt nextAction notes outcome outcomeNote completedAt assignedToUserId createdById createdAt updatedAt",
    )
    .populate("assignedToUserId", "fullName email role")
    .populate("createdById", "fullName email role")
    .lean();
  const followUps = serializeForJson(followUpDocs) as LeadFollowUpItem[];

  // Guarded: a cold prospect may have no email at all.
  const fallbackClient =
    !lead.phone && lead.email
      ? await ClientModel.findOne({ primaryContactEmail: lead.email.toLowerCase().trim() })
          .select("primaryContactPhone")
          .lean()
      : null;
  const descriptionPhone = !lead.phone ? extractPhoneFromDescription(lead.description) : "";
  const resolvedPhone = lead.phone || fallbackClient?.primaryContactPhone || descriptionPhone;

  const inviteDoc = await ClientInviteModel.findOne({ leadId: leadDoc._id })
    .sort({ createdAt: -1 })
    .select("status email createdAt acceptedAt createdClientUserId")
    .lean();
  const linkedClientUserDoc =
    inviteDoc?.status === "accepted" && inviteDoc.createdClientUserId
      ? await UserModel.findById(inviteDoc.createdClientUserId).select("fullName email status").lean()
      : null;
  const invite = inviteDoc
    ? (serializeForJson({
        status: inviteDoc.status,
        email: inviteDoc.email,
        createdAt: inviteDoc.createdAt,
        acceptedAt: inviteDoc.acceptedAt,
      }) as ClientInvitePanelProps["invite"])
    : null;
  const linkedClientUser = linkedClientUserDoc
    ? (serializeForJson(linkedClientUserDoc) as ClientInvitePanelProps["linkedClientUser"])
    : null;

  const latestBlueprint = await BlueprintModel.findOne({
    leadId: leadDoc._id,
    status: { $ne: "superseded" },
  })
    .sort({ version: -1 })
    .select("version status")
    .lean();

  const hasSignedScope = Boolean(
    await ScopeManifestModel.exists({ leadId: leadDoc._id, isCompleted: true, signedAt: { $ne: null } }),
  );
  const latestProposal = await ProposalModel.findOne({ leadId: leadDoc._id })
    .sort({ version: -1 })
    .select("version status approvalStatus")
    .lean();

  const greetingName = lead.contactName || lead.title;
  const phoneForCall = normalizePhoneForCall(resolvedPhone);
  const phoneForWhatsApp = normalizePhoneForWhatsApp(resolvedPhone);
  const callHref = phoneForCall ? `tel:${phoneForCall}` : "";
  const messageText = encodeURIComponent(
    `Hi ${greetingName}, this is Nemnidhi team regarding "${lead.title}". Please let us know a good time to connect.`,
  );
  const messageHref = phoneForWhatsApp
    ? `https://wa.me/${phoneForWhatsApp}?text=${messageText}`
    : "";
  const mailSubject = encodeURIComponent(`Regarding ${lead.title}`);
  const mailBody = encodeURIComponent(
    `Hi ${greetingName},\n\nThis is a follow-up regarding: ${lead.title}.\n\nRegards,\nNemnidhi Team`,
  );
  const mailHref = lead.email ? `mailto:${lead.email}?subject=${mailSubject}&body=${mailBody}` : "";
  const leadStages = [
    { label: "Lead", state: "Captured", variant: "success" as const },
    { label: "Scope", state: hasSignedScope ? "Signed" : latestBlueprint ? "In Review" : "Pending", variant: hasSignedScope ? "success" as const : latestBlueprint ? "accent" as const : "neutral" as const },
    {
      label: "Proposal",
      state: latestProposal ? humanize(latestProposal.status) : "Pending",
      variant: latestProposal?.status === "signed" ? "success" as const : latestProposal ? "warning" as const : "neutral" as const,
    },
    { label: "Project", state: latestProposal?.status === "signed" ? "Ready" : "Locked", variant: latestProposal?.status === "signed" ? "accent" as const : "neutral" as const },
    { label: "Delivery", state: "Queued", variant: "neutral" as const },
  ];
  const nextFollowUp = followUps.find((item) => item.status !== "completed" && item.status !== "cancelled");

  return (
    <section className="space-y-4">
      <div className="space-y-3 lg:hidden">
        <Link href="/leads" className="inline-flex items-center gap-1.5 text-xs font-medium text-vega-text-secondary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Leads
        </Link>

        <header className="space-y-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 className="truncate text-[22px] font-semibold leading-7 text-vega-text">{lead.title}</h2>
            <ExternalLink className="h-5 w-5 shrink-0 text-vega-purple" aria-hidden="true" />
          </div>
          <p className="text-sm text-vega-text-muted">
            {lead.contactName || "No contact sourced"} - {humanize(lead.source)}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={statusVariant(lead.status)}>{humanize(lead.status)}</Badge>
            {lead.urgency ? <Badge variant={urgencyVariant(lead.urgency)}>{humanize(lead.urgency)} urgency</Badge> : null}
            <Badge variant={priorityVariant(lead.priorityBand)}>{humanize(lead.priorityBand)}</Badge>
          </div>
        </header>

        <div className="grid grid-cols-3 gap-2">
          <a href={callHref || undefined} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md border border-vega-border bg-vega-surface-1 text-xs font-semibold text-vega-text">
            <span className="text-success"><PhoneIcon /></span>
            Call
          </a>
          <a href={messageHref || undefined} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md border border-vega-border bg-vega-surface-1 text-xs font-semibold text-vega-text">
            <span className="text-[#25d366]"><WhatsAppIcon /></span>
            WhatsApp
          </a>
          <a href={mailHref || undefined} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md border border-vega-border bg-vega-surface-1 text-xs font-semibold text-vega-text">
            <MailIcon />
            Mail
          </a>
        </div>

        <Card>
          <CardContent className="space-y-3 p-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex gap-2">
                <User className="mt-0.5 h-5 w-5 shrink-0 text-blue-300" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-[11px] text-vega-text-muted">Contact</p>
                  <p className="truncate text-xs font-semibold text-vega-text">{lead.contactName || "Not sourced"}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Phone className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-[11px] text-vega-text-muted">Phone</p>
                  <p className="truncate text-xs font-semibold text-vega-text">{resolvedPhone || "Not shared"}</p>
                </div>
              </div>
              <div className="col-span-2 flex gap-2">
                <Mail className="mt-0.5 h-5 w-5 shrink-0 text-blue-300" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-[11px] text-vega-text-muted">Email</p>
                  <p className="truncate text-xs font-semibold text-vega-text">{lead.email || "Not sourced"}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-vega-border-soft pt-3">
              <div className="flex gap-2">
                <BarChart3 className="mt-0.5 h-5 w-5 shrink-0 text-vega-purple" aria-hidden="true" />
                <div>
                  <p className="text-[11px] text-vega-text-muted">Score</p>
                  <p className="text-xs font-semibold text-vega-text">{lead.score ?? 0}</p>
                  <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-vega-surface-2">
                    <div className="h-full rounded-full bg-vega-purple" style={{ width: `${Math.min(100, lead.score ?? 0)}%` }} />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 border-l border-vega-border-soft pl-3">
                <User className="mt-0.5 h-5 w-5 shrink-0 text-blue-300" aria-hidden="true" />
                <div>
                  <p className="text-[11px] text-vega-text-muted">Assigned to</p>
                  <p className="text-xs font-semibold text-vega-text">Somil Jain</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-4 border-b border-vega-border-soft">
          {[
            { label: "Overview", icon: ClipboardList, href: "#overview" },
            { label: "Follow-ups", icon: CalendarDays, href: "#follow-ups" },
            { label: "Activity", icon: Zap, href: "#activity" },
            { label: "Notes", icon: NotebookText, href: "#notes" },
          ].map((tab, index) => {
            const Icon = tab.icon;
            return (
              <a
                key={tab.label}
                href={tab.href}
                className={`inline-flex h-11 min-w-0 items-center justify-center gap-1.5 border-b-2 px-1 text-[11px] font-semibold ${
                  index === 0 ? "border-vega-purple text-[#c4b5fd]" : "border-transparent text-vega-text-muted"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {tab.label}
              </a>
            );
          })}
        </div>

        <Card id="follow-ups">
          <CardContent className="space-y-3 p-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-vega-purple" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-vega-text">Next follow-up</h3>
            </div>
            {nextFollowUp ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-vega-text">{humanize(nextFollowUp.channel)} {lead.contactName || lead.title}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-vega-text-muted">
                      <CalendarDays className="h-4 w-4" aria-hidden="true" />
                      {formatDateTime(nextFollowUp.dueAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Badge variant="accent">{humanize(nextFollowUp.status)}</Badge>
                    <Badge variant={nextFollowUp.priority === "urgent" ? "danger" : "warning"}>{humanize(nextFollowUp.priority)}</Badge>
                  </div>
                </div>
                <p className="text-xs leading-5 text-vega-text-secondary">{nextFollowUp.nextAction}</p>
                <div className="grid grid-cols-2 gap-2">
                  <a href="#follow-up-panel" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-vega-border bg-vega-surface-1 text-xs font-semibold text-vega-text-secondary">
                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                    Reschedule
                  </a>
                  <a href="#follow-up-panel" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-vega-purple text-xs font-semibold text-white">
                    <Check className="h-4 w-4" aria-hidden="true" />
                    Mark complete
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-xs text-vega-text-muted">No follow-up scheduled yet.</p>
            )}
          </CardContent>
        </Card>

        <Card id="overview">
          <CardHeader className="flex-row items-center justify-between p-3 pb-2">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-vega-purple" aria-hidden="true" />
              <CardTitle>Lead summary</CardTitle>
            </div>
            <a href="#edit-lead" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-vega-border px-2.5 text-xs font-semibold text-vega-text-secondary">
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Edit
            </a>
          </CardHeader>
          <CardContent className="space-y-2.5 p-3 pt-1">
            <div className="grid grid-cols-2 gap-2">
              {[
                ["Source", humanize(lead.source)],
                ["Category", lead.category ? humanize(lead.category) : "Not qualified"],
                ["Budget", formatBudget(lead.budget)],
                ["Updated", formatDateTime(lead.updatedAt)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-vega-border-soft bg-vega-surface-2 p-2.5">
                  <p className="text-[10px] text-vega-text-muted">{label}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-vega-text">{value}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-vega-border-soft pt-3">
              <p className="text-[10px] text-vega-text-muted">Requirement</p>
              <p className="mt-1 text-xs leading-5 text-vega-text">{lead.description || "No requirement captured."}</p>
            </div>
            {lead.tags?.length ? (
              <div className="flex flex-wrap gap-2">
                {lead.tags.map((tag) => <Badge key={tag} variant="neutral">{tag}</Badge>)}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2 p-3 pb-2">
            <BarChart3 className="h-5 w-5 text-vega-purple" aria-hidden="true" />
            <CardTitle>Pipeline progress</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <div className="relative space-y-2 pl-6 before:absolute before:left-[9px] before:top-3 before:h-[calc(100%-24px)] before:w-px before:bg-vega-border">
              {leadStages.map((stage, index) => (
                <div key={stage.label} className="relative flex items-center justify-between gap-3">
                  <span className={`absolute -left-[20px] h-4 w-4 rounded-full ${index === 0 ? "bg-success" : "bg-[#b6c7e6]"}`} />
                  <span className="text-xs font-semibold text-vega-text">{stage.label}</span>
                  <Badge variant={stage.variant}>{stage.state}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card id="notes" className="p-3">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold text-vega-text">
                <NotebookText className="h-5 w-5 text-vega-purple" aria-hidden="true" />
                Notes
              </span>
              <span className="text-xs font-semibold text-vega-purple">+ Add note</span>
            </summary>
            <div className="mt-3"><LeadDairy leadId={lead._id} notes={leadNotes} /></div>
          </details>
          {leadNotes.length === 0 ? <p className="mt-2 flex items-center gap-2 text-xs text-vega-text-muted group-open:hidden"><NotebookText className="h-4 w-4" aria-hidden="true" />No notes added yet.</p> : null}
        </Card>

        <details className="rounded-lg border border-vega-border bg-vega-surface-1 p-3">
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-vega-text">
            <span className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-vega-purple" aria-hidden="true" />
              Next steps <Badge variant="accent">2</Badge>
            </span>
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </summary>
          <div className="mt-4 space-y-3">
            <Link href={`/blueprint/${lead._id}`} className="block rounded-md border border-vega-border-soft bg-vega-surface-2 p-3 text-sm font-semibold text-vega-text">Blueprint</Link>
            <Link href={`/proposals/${lead._id}`} className="block rounded-md border border-vega-border-soft bg-vega-surface-2 p-3 text-sm font-semibold text-vega-text">Proposal</Link>
          </div>
        </details>

        <details className="rounded-lg border border-vega-border bg-vega-surface-1 p-3">
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-vega-text">
            <span className="flex items-center gap-2">
              <Users className="h-5 w-5 text-vega-purple" aria-hidden="true" />
              Client portal
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-normal text-vega-text-muted">
              {invite ? humanize(invite.status) : "Not invited"}
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </span>
          </summary>
          <div className="mt-4">
            <ClientInvitePanel leadId={lead._id} hasEmail={Boolean(lead.email)} invite={invite} linkedClientUser={linkedClientUser} />
          </div>
        </details>

        <div id="follow-up-panel" className="hidden scroll-mt-16 target:block">
          <LeadFollowUpPanel leadId={lead._id} followUps={followUps} />
        </div>

        <Card id="edit-lead" className="hidden scroll-mt-16 target:block">
          <CardHeader>
            <CardTitle>Edit Lead</CardTitle>
          </CardHeader>
          <CardContent>
            <LeadFieldsEditor
              lead={{
                id: lead._id,
                title: lead.title,
                contactName: lead.contactName ?? "",
                email: lead.email ?? "",
                phone: lead.phone,
                source: lead.source,
                category: lead.category ?? "",
                urgency: lead.urgency ?? "",
                description: lead.description ?? "",
                budget: lead.budget,
                sourceDomain: lead.sourceDomain,
                sourcePath: lead.sourcePath,
                sourceReferrer: lead.sourceReferrer,
                tags: lead.tags,
              }}
            />
          </CardContent>
        </Card>

        <a href="#follow-up-panel" className="sticky bottom-2 z-20 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-vega-purple text-sm font-semibold text-white shadow-[0_10px_30px_rgba(124,63,224,0.35)]">
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          Schedule follow-up
        </a>
      </div>

      <div className="hidden space-y-4 lg:block">
      <header className="border-b border-vega-border-soft pb-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-vega-text-muted">Operations / Leads</p>
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="truncate text-[28px] font-semibold leading-[34px] tracking-normal text-vega-text">
                {lead.title}
              </h2>
              <ExternalLink className="h-5 w-5 text-vega-purple" aria-hidden="true" />
            </div>
            <p className="mt-1 text-sm text-vega-text-muted">
              {lead.contactName || "No contact sourced"} / {humanize(lead.source)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(lead.status)}>{humanize(lead.status)}</Badge>
              {lead.urgency ? (
                <Badge variant={urgencyVariant(lead.urgency)}>{humanize(lead.urgency)} Urgency</Badge>
              ) : null}
              <Badge variant={priorityVariant(lead.priorityBand)}>{humanize(lead.priorityBand)}</Badge>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <Link
              href="/leads"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-vega-border bg-vega-surface-1 px-4 text-sm font-semibold text-vega-text-secondary transition-colors hover:border-vega-purple-border hover:bg-vega-surface-hover hover:text-vega-text"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to Leads
            </Link>
            <a
              href="#edit-lead"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-vega-purple px-4 text-sm font-semibold text-white transition-colors hover:bg-vega-purple-strong"
            >
              <Edit3 className="h-4 w-4" aria-hidden="true" />
              Edit Lead
            </a>
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          { label: "Contact", value: lead.contactName || "Not sourced", icon: User, tone: "text-[#8b5cf6]" },
          { label: "Phone", value: resolvedPhone || "Not shared", icon: Phone, tone: "text-success" },
          { label: "Email", value: lead.email || "Not sourced", icon: Mail, tone: "text-blue-300" },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.label} className="border-vega-border bg-vega-surface-1">
              <CardContent className="flex items-center gap-3 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-vega-border-soft bg-vega-surface-2">
                  <Icon className={`h-5 w-5 ${item.tone}`} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <p className="text-xs text-vega-text-muted">{item.label}</p>
                  <p className="mt-1 truncate text-sm font-semibold text-vega-text">{item.value}</p>
                </span>
              </CardContent>
            </Card>
          );
        })}
        <Card className="border-vega-border bg-vega-surface-1">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-vega-border-soft bg-vega-surface-2">
              <BadgeCheck className="h-5 w-5 text-vega-purple" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <p className="text-xs text-vega-text-muted">Status</p>
              <LeadStatusSelect
                key={`${lead._id}-${lead.status}`}
                leadId={lead._id}
                currentStatus={lead.status}
                compact
                className="mt-1"
              />
            </span>
          </CardContent>
        </Card>
        {[
          { label: "Source", value: humanize(lead.source), icon: Globe2, tone: "text-[#9ca3ff]" },
          { label: "Score", value: String(lead.score ?? 0), icon: BarChart3, tone: "text-[#8b5cf6]" },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.label} className="border-vega-border bg-vega-surface-1">
              <CardContent className="flex items-center gap-3 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-vega-border-soft bg-vega-surface-2">
                  <Icon className={`h-5 w-5 ${item.tone}`} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <p className="text-xs text-vega-text-muted">{item.label}</p>
                  <p className="mt-1 truncate text-sm font-semibold text-vega-text">{item.value}</p>
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-vega-border-soft p-0">
              <div className="flex min-w-0 overflow-x-auto">
                {[
                  { label: "Overview", icon: ClipboardList, active: true, href: "#overview" },
                  { label: "Follow-ups", icon: CalendarDays, active: false, href: "#follow-ups" },
                  { label: "Activity", icon: Zap, active: false, href: "#activity" },
                  { label: "Notes", icon: NotebookText, active: false, href: "#notes" },
                  { label: "Edit Lead", icon: Pencil, active: false, href: "#edit-lead" },
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <a
                      key={tab.label}
                      href={tab.href}
                      className={`inline-flex h-12 shrink-0 items-center gap-2 border-b-2 px-6 text-sm font-semibold transition-colors ${
                        tab.active
                          ? "border-vega-purple bg-vega-purple-soft text-[#ddd6fe]"
                          : "border-transparent text-vega-text-muted hover:bg-vega-surface-hover hover:text-vega-text"
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {tab.label}
                    </a>
                  );
                })}
              </div>
            </CardHeader>
            <CardContent id="follow-ups" className="p-3">
              <LeadFollowUpPanel leadId={lead._id} followUps={followUps} />
            </CardContent>
          </Card>

          <div id="overview" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-vega-purple" aria-hidden="true" />
                <CardTitle>Lead Summary</CardTitle>
              </div>
              <a
                href="#edit-lead"
                className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-vega-border bg-vega-surface-1 px-3 text-xs font-semibold text-vega-text-secondary transition-colors hover:border-vega-purple-border hover:text-vega-text"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Edit
              </a>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 md:grid-cols-4">
                <div className="rounded-md border border-vega-border-soft bg-vega-surface-2 p-3">
                  <p className="text-[10px] text-vega-text-muted">Source</p>
                  <p className="mt-1 text-xs font-medium text-vega-text">{humanize(lead.source)}</p>
                </div>
                <div className="rounded-md border border-vega-border-soft bg-vega-surface-2 p-3">
                  <p className="text-[10px] text-vega-text-muted">Category</p>
                  <p className="mt-1 text-xs font-medium text-vega-text">
                    {lead.category ? humanize(lead.category) : "Not qualified yet"}
                  </p>
                </div>
                <div className="rounded-md border border-vega-border-soft bg-vega-surface-2 p-3">
                  <p className="text-[10px] text-vega-text-muted">Budget</p>
                  <p className="mt-1 text-xs font-medium text-vega-text">{formatBudget(lead.budget)}</p>
                </div>
                <div className="rounded-md border border-vega-border-soft bg-vega-surface-2 p-3">
                  <p className="text-[10px] text-vega-text-muted">Last Updated</p>
                  <p className="mt-1 text-xs font-medium text-vega-text">{formatDateTime(lead.updatedAt)}</p>
                </div>
              </div>

              <div className="rounded-md border border-vega-border-soft bg-vega-surface-2 p-3">
                <p className="text-[10px] text-vega-text-muted">Requirement Description</p>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-vega-text-secondary">
                  {lead.description || "No requirement captured."}
                </p>
              </div>

              {lead.tags?.length ? (
                <div className="flex flex-wrap gap-2">
                  {lead.tags.map((tag) => (
                    <Badge key={tag} variant="neutral">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card id="notes">
            <CardHeader className="flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <NotebookText className="h-5 w-5 text-vega-purple" aria-hidden="true" />
                <CardTitle>Notes</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <LeadDairy leadId={lead._id} notes={leadNotes} />
            </CardContent>
          </Card>
          </div>

          {lead.prospecting ? (
            <Card>
              <CardHeader>
                <CardTitle>Digital Presence Audit</CardTitle>
              </CardHeader>
              <CardContent>
                <AuditReportPanel
                  leadId={lead._id}
                  hasEmail={Boolean(lead.email)}
                  prospecting={
                    lead.prospecting as unknown as React.ComponentProps<
                      typeof AuditReportPanel
                    >["prospecting"]
                  }
                />
              </CardContent>
            </Card>
          ) : null}

          <Card id="edit-lead">
            <CardHeader>
              <CardTitle>Edit Lead</CardTitle>
            </CardHeader>
            <CardContent>
              <LeadFieldsEditor
                lead={{
                  id: lead._id,
                  title: lead.title,
                  contactName: lead.contactName ?? "",
                  email: lead.email ?? "",
                  phone: lead.phone,
                  source: lead.source,
                  category: lead.category ?? "",
                  urgency: lead.urgency ?? "",
                  description: lead.description ?? "",
                  budget: lead.budget,
                  sourceDomain: lead.sourceDomain,
                  sourcePath: lead.sourcePath,
                  sourceReferrer: lead.sourceReferrer,
                  tags: lead.tags,
                }}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <Zap className="h-5 w-5 text-vega-purple" aria-hidden="true" />
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-3 xl:grid-cols-3">
              {callHref ? (
                <a
                  href={callHref}
                  className="inline-flex h-[36px] items-center justify-center gap-2 rounded-md border border-vega-border bg-vega-surface-1 px-3 text-xs font-medium text-vega-text-secondary transition-colors hover:border-vega-purple-border hover:bg-vega-surface-hover hover:text-vega-text"
                >
                  <span className="text-[#1d7a46]">
                    <PhoneIcon />
                  </span>
                  Call
                </a>
              ) : null}

              {messageHref ? (
                <a
                  href={messageHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-[36px] items-center justify-center gap-2 rounded-md border border-vega-border bg-vega-surface-1 px-3 text-xs font-medium text-vega-text-secondary transition-colors hover:border-vega-purple-border hover:bg-vega-surface-hover hover:text-vega-text"
                >
                  <span className="text-[#25d366]">
                    <WhatsAppIcon />
                  </span>
                  WhatsApp
                </a>
              ) : null}

              {mailHref ? (
                <a
                  href={mailHref}
                  className="inline-flex h-[36px] items-center justify-center gap-2 rounded-md border border-vega-border bg-vega-surface-1 px-3 text-xs font-medium text-vega-text-secondary transition-colors hover:border-vega-purple-border hover:bg-vega-surface-hover hover:text-vega-text"
                >
                  <MailIcon />
                  Mail
                </a>
              ) : null}

              {!callHref && !messageHref && !mailHref ? (
                <p className="text-xs leading-5 text-vega-text-muted">No contact action available.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <ClipboardList className="h-5 w-5 text-vega-purple" aria-hidden="true" />
              <CardTitle>Pipeline Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative space-y-2 pl-5 before:absolute before:left-[7px] before:top-3 before:h-[calc(100%-24px)] before:w-px before:bg-vega-border">
                {leadStages.map((stage, index) => (
                  <div
                    key={stage.label}
                    className="relative flex items-center justify-between gap-3 rounded-md bg-vega-surface-2 px-3 py-2"
                  >
                    <span
                      className={`absolute -left-[20px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border border-vega-surface-1 ${
                        index === 0 ? "bg-success" : "bg-vega-text-dim"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="text-xs font-medium text-vega-text">{stage.label}</span>
                    <Badge variant={stage.variant}>{stage.state}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <Zap className="h-5 w-5 text-vega-purple" aria-hidden="true" />
              <CardTitle>Next Steps</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border border-vega-border-soft bg-vega-surface-2 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="h-4 w-4 text-[#c4b5fd]" aria-hidden="true" />
                    <div>
                      <p className="text-xs font-medium text-vega-text">Blueprint</p>
                      <p className="text-[11px] text-vega-text-muted">Create project blueprint</p>
                    </div>
                  </div>
                  {latestBlueprint ? (
                    <Badge variant={latestBlueprint.status === "approved" ? "success" : "neutral"}>
                      v{latestBlueprint.version}
                    </Badge>
                  ) : (
                    <Badge variant="neutral">Pending</Badge>
                  )}
                </div>
                <a
                  href={`/blueprint/${lead._id}`}
                  className="mt-3 inline-flex h-[32px] w-full items-center justify-center rounded-md border border-vega-border bg-vega-surface-1 px-3 text-xs font-medium text-vega-text-secondary transition-colors hover:border-vega-purple-border hover:bg-vega-surface-hover hover:text-vega-text"
                >
                  {latestBlueprint ? "Open Blueprint" : "Start Blueprint"}
                </a>
              </div>

              <div className="rounded-md border border-vega-border-soft bg-vega-surface-2 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#c4b5fd]" aria-hidden="true" />
                    <div>
                      <p className="text-xs font-medium text-vega-text">Proposal</p>
                      <p className="text-[11px] text-vega-text-muted">Create and send proposal</p>
                    </div>
                  </div>
                  {latestProposal ? (
                    <Badge variant={latestProposal.status === "signed" ? "success" : "neutral"}>
                      v{latestProposal.version}
                    </Badge>
                  ) : (
                    <Badge variant="neutral">{hasSignedScope ? "Pending" : "Locked"}</Badge>
                  )}
                </div>
                <a
                  href={`/proposals/${lead._id}`}
                  className="mt-3 inline-flex h-[32px] w-full items-center justify-center rounded-md border border-vega-border bg-vega-surface-1 px-3 text-xs font-medium text-vega-text-secondary transition-colors hover:border-vega-purple-border hover:bg-vega-surface-hover hover:text-vega-text"
                >
                  {latestProposal ? "Open Proposal" : "Start Proposal"}
                </a>
              </div>

              <ClientInvitePanel
                leadId={lead._id}
                hasEmail={Boolean(lead.email)}
                invite={invite}
                linkedClientUser={linkedClientUser}
              />
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
    </section>
  );
}
