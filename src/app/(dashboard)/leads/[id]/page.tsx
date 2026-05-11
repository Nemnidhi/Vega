import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { LeadStatusSelect } from "@/components/leads/lead-status-select";
import { LeadFieldsEditor } from "@/components/leads/lead-fields-editor";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { connectToDatabase } from "@/lib/db/mongodb";
import { ClientModel, LeadModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";
import { requireRoleAccess } from "@/lib/auth/role-access";

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
  await requireRoleAccess(["admin", "sales"]);

  const { id } = await params;
  await connectToDatabase();

  const leadDoc = await LeadModel.findById(id)
    .select(
      "title contactName email phone source sourceDomain sourcePath sourceReferrer category urgency score priorityBand priorityFlag status description budget tags createdAt updatedAt",
    )
    .lean();

  if (!leadDoc) {
    notFound();
  }

  const lead = serializeForJson(leadDoc) as {
    _id: string;
    title: string;
    contactName: string;
    email: string;
    phone?: string;
    source: string;
    sourceDomain?: string;
    sourcePath?: string;
    sourceReferrer?: string;
    category: string;
    urgency: string;
    score: number;
    priorityBand: string;
    priorityFlag: boolean;
    status: string;
    description: string;
    budget?: { min: number; max: number; currency: string };
    tags?: string[];
    createdAt?: string;
    updatedAt?: string;
  };

  const fallbackClient = !lead.phone
    ? await ClientModel.findOne({ primaryContactEmail: lead.email.toLowerCase().trim() })
        .select("primaryContactPhone")
        .lean()
    : null;
  const descriptionPhone = !lead.phone ? extractPhoneFromDescription(lead.description) : "";
  const resolvedPhone = lead.phone || fallbackClient?.primaryContactPhone || descriptionPhone;

  const phoneForCall = normalizePhoneForCall(resolvedPhone);
  const phoneForWhatsApp = normalizePhoneForWhatsApp(resolvedPhone);
  const callHref = phoneForCall ? `tel:${phoneForCall}` : "";
  const messageText = encodeURIComponent(
    `Hi ${lead.contactName}, this is Nemnidhi team regarding "${lead.title}". Please let us know a good time to connect.`,
  );
  const messageHref = phoneForWhatsApp
    ? `https://wa.me/${phoneForWhatsApp}?text=${messageText}`
    : "";
  const mailSubject = encodeURIComponent(`Regarding ${lead.title}`);
  const mailBody = encodeURIComponent(
    `Hi ${lead.contactName},\n\nThis is a follow-up regarding: ${lead.title}.\n\nRegards,\nNemnidhi Team`,
  );
  const mailHref = `mailto:${lead.email}?subject=${mailSubject}&body=${mailBody}`;

  return (
    <section className="space-y-6">
      <DashboardHeader
        title={lead.title}
        subtitle="Structured lead profile with quick actions and pipeline controls."
        showLeadCta={false}
        action={{ label: "Back To Leads", href: "/leads" }}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contact and Quick Actions</CardTitle>
              <CardDescription>Call, message, or email from one place.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border bg-surface-soft p-3">
                  <p className="text-xs text-muted-foreground">Contact Name</p>
                  <p className="mt-1 font-semibold text-foreground">{lead.contactName}</p>
                </div>
                <div className="rounded-lg border border-border bg-surface-soft p-3">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="mt-1 font-semibold text-foreground break-all">{lead.email}</p>
                </div>
                <div className="rounded-lg border border-border bg-surface-soft p-3 md:col-span-2">
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="mt-1 font-semibold text-foreground">{resolvedPhone || "Not shared"}</p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                {callHref ? (
                  <a
                    href={callHref}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 text-sm font-semibold tracking-wide text-foreground transition-colors hover:bg-surface-soft"
                  >
                    <span className="text-[#1d7a46]">
                      <PhoneIcon />
                    </span>
                    Call
                  </a>
                ) : (
                  <span className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-surface-soft px-4 text-sm font-semibold tracking-wide text-muted-foreground">
                    Call Unavailable
                  </span>
                )}

                {messageHref ? (
                  <a
                    href={messageHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 text-sm font-semibold tracking-wide text-foreground transition-colors hover:bg-surface-soft"
                  >
                    <span className="text-[#25d366]">
                      <WhatsAppIcon />
                    </span>
                    WhatsApp
                  </a>
                ) : (
                  <span className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-surface-soft px-4 text-sm font-semibold tracking-wide text-muted-foreground">
                    Message Unavailable
                  </span>
                )}

                <a
                  href={mailHref}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 text-sm font-semibold tracking-wide text-foreground transition-colors hover:bg-surface-soft"
                >
                  <MailIcon />
                  Mail
                </a>
              </div>

              {!resolvedPhone ? (
                <p className="text-xs text-muted-foreground">
                  Add phone number in lead record to enable direct call and message actions.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lead Overview</CardTitle>
              <CardDescription>Structured business context and requirement summary.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border bg-white p-3">
                  <p className="text-xs text-muted-foreground">Source</p>
                  <p className="mt-1 font-semibold text-foreground">{humanize(lead.source)}</p>
                </div>
                <div className="rounded-lg border border-border bg-white p-3">
                  <p className="text-xs text-muted-foreground">Category</p>
                  <p className="mt-1 font-semibold text-foreground">{humanize(lead.category)}</p>
                </div>
                <div className="rounded-lg border border-border bg-white p-3">
                  <p className="text-xs text-muted-foreground">Budget</p>
                  <p className="mt-1 font-semibold text-foreground">{formatBudget(lead.budget)}</p>
                </div>
                <div className="rounded-lg border border-border bg-white p-3">
                  <p className="text-xs text-muted-foreground">Last Updated</p>
                  <p className="mt-1 font-semibold text-foreground">{formatDateTime(lead.updatedAt)}</p>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-surface-soft p-3">
                <p className="text-xs text-muted-foreground">Requirement Description</p>
                <p className="mt-1 whitespace-pre-wrap leading-6 text-foreground">{lead.description}</p>
              </div>

              {lead.tags?.length ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {lead.tags.map((tag) => (
                      <Badge key={tag} variant="neutral">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-lg border border-border bg-white p-3">
                <p className="text-xs text-muted-foreground">Source Tracking</p>
                <div className="mt-2 space-y-1 text-sm">
                  <p>
                    <span className="text-muted-foreground">Domain:</span>{" "}
                    {lead.sourceDomain || "Not captured"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Path:</span> {lead.sourcePath || "Not captured"}
                  </p>
                  <p className="break-all">
                    <span className="text-muted-foreground">Referrer:</span>{" "}
                    {lead.sourceReferrer || "Not captured"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Created:</span> {formatDateTime(lead.createdAt)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Edit Lead Fields</CardTitle>
              <CardDescription>
                Admin and sales can update core lead details from here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LeadFieldsEditor
                lead={{
                  id: lead._id,
                  title: lead.title,
                  contactName: lead.contactName,
                  email: lead.email,
                  phone: lead.phone,
                  source: lead.source,
                  category: lead.category,
                  urgency: lead.urgency,
                  description: lead.description,
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
                <div className="rounded-lg border border-border bg-white p-3">
                  <p className="text-xs text-muted-foreground">Current Status</p>
                  <div className="mt-1">
                    <Badge variant={statusVariant(lead.status)}>{humanize(lead.status)}</Badge>
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-white p-3">
                  <p className="text-xs text-muted-foreground">Urgency</p>
                  <div className="mt-1">
                    <Badge variant={urgencyVariant(lead.urgency)}>{humanize(lead.urgency)}</Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Change Status</p>
                <LeadStatusSelect leadId={lead._id} currentStatus={lead.status} />
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
              <p className="text-sm text-muted-foreground">
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
            <CardContent className="space-y-2 text-sm text-muted-foreground">
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
