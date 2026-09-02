import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { LeadDairy } from "@/components/leads/lead-dairy";
import { LeadStatusSelect } from "@/components/leads/lead-status-select";
import { LeadFieldsEditor } from "@/components/leads/lead-fields-editor";
import { AuditReportPanel } from "@/components/leads/audit-report-panel";
import { ClientInvitePanel, type ClientInvitePanelProps } from "@/components/leads/client-invite-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { connectToDatabase } from "@/lib/db/mongodb";
import {
  BlueprintModel,
  ClientModel,
  ClientInviteModel,
  LeadModel,
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
  if (status === "closed_lost") return "danger";
  if (status === "closed_won") return "success";
  if (status === "proposal_sent" || status === "negotiation") return "warning";
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

  return (
    <section className="space-y-4">
      <DashboardHeader
        title={lead.title}
        subtitle="Structured lead profile with quick actions and pipeline controls."
        showLeadCta={false}
        action={{ label: "Back To Leads", href: "/leads" }}
      />

      <Card className="border-vega-purple-border">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-vega-purple-border bg-vega-purple-soft text-sm font-semibold text-[#c4b5fd]">
                {lead.title.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-[22px] font-semibold leading-7 text-vega-text">{lead.title}</h3>
                <p className="mt-1 text-xs text-vega-text-muted">
                  {lead.contactName || "No contact sourced"} / {lead.source.replaceAll("_", " ")}
                </p>
              </div>
            </div>
            <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              {[
                ["Lead Score", lead.score ?? 0],
                ["Source", humanize(lead.source)],
                ["Budget", formatBudget(lead.budget)],
                ["Owner", "Sales"],
                ["Status", humanize(lead.status)],
                ["Next Follow-up", formatDateTime(lead.updatedAt)],
              ].map(([label, value]) => (
                <div key={label} className="border-l border-vega-border-soft pl-3 first:border-l-0 first:pl-0">
                  <p className="text-[10px] leading-4 text-vega-text-dim">{label}</p>
                  <p className="mt-0.5 max-w-40 truncate font-medium text-vega-text-secondary">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex overflow-x-auto border-b border-vega-border-soft">
        {["Overview", "Discovery", "Scope Lock", "Blueprint", "Proposal", "Activity"].map((tab, index) => (
          <span
            key={tab}
            className={`whitespace-nowrap px-3 py-3 text-xs font-medium ${index === 0 ? "border-b-2 border-vega-purple text-[#c4b5fd]" : "text-vega-text-muted"}`}
          >
            {tab}
          </span>
        ))}
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="grid gap-2 md:grid-cols-5">
            {leadStages.map((stage, index) => (
              <div key={stage.label} className="flex items-center gap-2">
                <div className="min-w-0 flex-1 rounded-md border border-vega-border-soft bg-vega-surface-2 p-2.5">
                  <p className="text-xs font-medium text-vega-text">{stage.label}</p>
                  <div className="mt-1">
                    <Badge variant={stage.variant}>{stage.state}</Badge>
                  </div>
                </div>
                {index < leadStages.length - 1 ? (
                  <span className="hidden text-vega-text-dim md:block">-&gt;</span>
                ) : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contact and Quick Actions</CardTitle>
              <CardDescription>Call, message, or email from one place.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-vega-border-soft bg-vega-surface-2 p-3">
                  <p className="text-[10px] text-vega-text-muted">Contact Name</p>
                  <p className="mt-1 text-xs font-medium text-vega-text">
                    {lead.contactName || "Not sourced"}
                  </p>
                </div>
                <div className="rounded-md border border-vega-border-soft bg-vega-surface-2 p-3">
                  <p className="text-[10px] text-vega-text-muted">Email</p>
                  <p className="mt-1 break-all text-xs font-medium text-vega-text">
                    {lead.email || "Not sourced"}
                  </p>
                </div>
                <div className="rounded-md border border-vega-border-soft bg-vega-surface-2 p-3 md:col-span-2">
                  <p className="text-[10px] text-vega-text-muted">Phone</p>
                  <p className="mt-1 text-xs font-medium text-vega-text">{resolvedPhone || "Not shared"}</p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                {callHref ? (
                  <a
                    href={callHref}
                    className="inline-flex h-[34px] items-center justify-center gap-2 rounded-md border border-vega-border bg-vega-surface-1 px-3 text-xs font-medium text-vega-text-secondary transition-colors hover:border-vega-purple-border hover:bg-vega-surface-hover hover:text-vega-text"
                  >
                    <span className="text-[#1d7a46]">
                      <PhoneIcon />
                    </span>
                    Call
                  </a>
                ) : (
                  <span className="inline-flex h-[34px] items-center justify-center rounded-md border border-vega-border bg-vega-surface-2 px-3 text-xs font-medium text-vega-text-muted">
                    Call Unavailable
                  </span>
                )}

                {messageHref ? (
                  <a
                    href={messageHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-[34px] items-center justify-center gap-2 rounded-md border border-vega-border bg-vega-surface-1 px-3 text-xs font-medium text-vega-text-secondary transition-colors hover:border-vega-purple-border hover:bg-vega-surface-hover hover:text-vega-text"
                  >
                    <span className="text-[#25d366]">
                      <WhatsAppIcon />
                    </span>
                    WhatsApp
                  </a>
                ) : (
                  <span className="inline-flex h-[34px] items-center justify-center rounded-md border border-vega-border bg-vega-surface-2 px-3 text-xs font-medium text-vega-text-muted">
                    Message Unavailable
                  </span>
                )}

                {mailHref ? (
                  <a
                    href={mailHref}
                    className="inline-flex h-[34px] items-center justify-center gap-2 rounded-md border border-vega-border bg-vega-surface-1 px-3 text-xs font-medium text-vega-text-secondary transition-colors hover:border-vega-purple-border hover:bg-vega-surface-hover hover:text-vega-text"
                  >
                    <MailIcon />
                    Mail
                  </a>
                ) : (
                  <span className="inline-flex h-[34px] items-center justify-center rounded-md border border-vega-border bg-vega-surface-2 px-3 text-xs font-medium text-vega-text-muted">
                    Mail Unavailable
                  </span>
                )}
              </div>

              {!resolvedPhone || !lead.email ? (
                <p className="text-xs text-vega-text-muted">
                  {lead.source === "cold_outreach"
                    ? "Cold prospects are sourced from public records and often carry no contact details. Source a phone or email before any outreach."
                    : "Add phone number in lead record to enable direct call and message actions."}
                </p>
              ) : null}
            </CardContent>
          </Card>

          {lead.prospecting ? (
            <Card>
              <CardHeader>
                <CardTitle>Digital Presence Audit</CardTitle>
                <CardDescription>
                  Cold-prospect audit: what their online presence looks like, and the report we can
                  send them about it.
                </CardDescription>
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

          <Card>
            <CardHeader>
              <CardTitle>Client Portal Access</CardTitle>
              <CardDescription>
                Invite this lead&apos;s contact to log in and review their audit and requirements
                directly.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ClientInvitePanel
                leadId={lead._id}
                hasEmail={Boolean(lead.email)}
                invite={invite}
                linkedClientUser={linkedClientUser}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Requirements Blueprint</CardTitle>
              <CardDescription>
                Discovery-call questionnaire, recommended components, and estimate range.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              {latestBlueprint ? (
                <Badge variant={latestBlueprint.status === "approved" ? "success" : "neutral"}>
                  v{latestBlueprint.version} - {latestBlueprint.status}
                </Badge>
              ) : (
                <span className="text-xs text-vega-text-muted">No blueprint created yet.</span>
              )}
              <a
                href={`/blueprint/${lead._id}`}
                className="inline-flex h-[34px] items-center justify-center rounded-md border border-vega-border bg-vega-surface-1 px-3 text-xs font-medium text-vega-text-secondary transition-colors hover:border-vega-purple-border hover:bg-vega-surface-hover hover:text-vega-text"
              >
                {latestBlueprint ? "Open Blueprint" : "Start Blueprint"}
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Proposal</CardTitle>
              <CardDescription>
                Formal scope, pricing, and signature - generated from the signed Scope Manifest.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              {latestProposal ? (
                <Badge variant={latestProposal.status === "signed" ? "success" : "neutral"}>
                  v{latestProposal.version} - {latestProposal.status}
                </Badge>
              ) : hasSignedScope ? (
                <span className="text-xs text-vega-text-muted">No proposal generated yet.</span>
              ) : (
                <span className="text-xs text-vega-text-muted">Lock scope first.</span>
              )}
              <a
                href={`/proposals/${lead._id}`}
                className="inline-flex h-[34px] items-center justify-center rounded-md border border-vega-border bg-vega-surface-1 px-3 text-xs font-medium text-vega-text-secondary transition-colors hover:border-vega-purple-border hover:bg-vega-surface-hover hover:text-vega-text"
              >
                {latestProposal ? "Open Proposal" : "Start Proposal"}
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lead Dairy</CardTitle>
              <CardDescription>Add and review lead notes from one place.</CardDescription>
            </CardHeader>
            <CardContent>
              <LeadDairy leadId={lead._id} notes={leadNotes} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lead Overview</CardTitle>
              <CardDescription>Structured business context and requirement summary.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-3 md:grid-cols-2">
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
                  {lead.description || "No requirement captured - this lead has not spoken to us yet."}
                </p>
              </div>

              {lead.tags?.length ? (
                <div className="space-y-2">
                  <p className="text-xs text-vega-text-muted">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {lead.tags.map((tag) => (
                      <Badge key={tag} variant="neutral">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-md border border-vega-border-soft bg-vega-surface-2 p-3">
                <p className="text-[10px] text-vega-text-muted">Source Tracking</p>
                <div className="mt-2 space-y-1 text-sm">
                  <p>
                    <span className="text-vega-text-muted">Domain:</span>{" "}
                    {lead.sourceDomain || "Not captured"}
                  </p>
                  <p>
                    <span className="text-vega-text-muted">Path:</span> {lead.sourcePath || "Not captured"}
                  </p>
                  <p className="break-all">
                    <span className="text-vega-text-muted">Referrer:</span>{" "}
                    {lead.sourceReferrer || "Not captured"}
                  </p>
                  <p>
                    <span className="text-vega-text-muted">Created:</span> {formatDateTime(lead.createdAt)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Edit Lead Fields</CardTitle>
              <CardDescription>
                Admin, sales, and digital marketing can update core lead details from here.
              </CardDescription>
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
            <CardHeader>
              <CardTitle>Pipeline Control</CardTitle>
              <CardDescription>Track urgency, status, and priority in one panel.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-md border border-vega-border-soft bg-vega-surface-2 p-3">
                  <p className="text-[10px] text-vega-text-muted">Current Status</p>
                  <div className="mt-1">
                    <Badge variant={statusVariant(lead.status)}>{humanize(lead.status)}</Badge>
                  </div>
                </div>
                <div className="rounded-md border border-vega-border-soft bg-vega-surface-2 p-3">
                  <p className="text-[10px] text-vega-text-muted">Urgency</p>
                  <div className="mt-1">
                    {lead.urgency ? (
                      <Badge variant={urgencyVariant(lead.urgency)}>{humanize(lead.urgency)}</Badge>
                    ) : (
                      <span className="text-xs text-vega-text-muted">Not set</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-vega-text-muted">Change Status</p>
                <LeadStatusSelect
                  key={`${lead._id}-${lead.status}`}
                  leadId={lead._id}
                  currentStatus={lead.status}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lead Health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-4xl font-semibold leading-none">{lead.score ?? 0}</p>
              <Badge variant={priorityVariant(lead.priorityBand)}>{humanize(lead.priorityBand)}</Badge>
              <p className="text-xs leading-5 text-vega-text-muted">
                {lead.priorityFlag
                  ? "Flagged as high-priority lead for fast follow-up."
                  : "This lead is currently in the standard follow-up path."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Follow-up Guide</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs leading-5 text-vega-text-muted">
              <p>1. Use Call for immediate discussion and qualification.</p>
              <p>2. Use Message to send a quick acknowledgement and next step.</p>
              <p>3. Use Mail for detailed scope or document-based follow-up.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
