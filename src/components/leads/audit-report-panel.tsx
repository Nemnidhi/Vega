"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CONFIDENCE_HELP,
  CONFIDENCE_VARIANT,
  TIER_LABEL,
  TIER_VARIANT,
  humanizeKey,
  isTier,
} from "@/lib/prospecting/tier-display";

type Signal = {
  checked?: boolean;
  found?: boolean | null;
  url?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  placeName?: string | null;
};

type SeoSignal = {
  checked?: boolean;
  seoScore?: number | null;
  performanceScore?: number | null;
  isMobileFriendly?: boolean;
  issues?: string[];
};

type MetaPresenceSignal = {
  checked?: boolean;
  facebookFound?: boolean | null;
  facebookFollowers?: number | null;
};

export type AuditPanelProps = {
  leadId: string;
  hasEmail: boolean;
  prospecting?: {
    industry?: string;
    segment?: string;
    industryConfidence?: string;
    industryMatchedOn?: string | null;
    unmappedIndustryLabel?: string | null;
    state?: string;
    district?: string;
    businessCategory?: string;
    prospectingStatus?: string;
    digitalPresence?: {
      website?: Signal;
      googleBusiness?: Signal;
      metaAds?: Signal;
      metaPresence?: MetaPresenceSignal;
      technicalSeo?: SeoSignal;
    };
    classification?: {
      category?: string;
      confidence?: string;
      signalsChecked?: number;
      signalsFound?: number;
      reasoning?: string;
    };
  } | null;
};

function signalText(signal?: Signal) {
  if (!signal) return "Not run";
  if (signal.checked === false) return "Not yet checked";
  if (signal.found) {
    if (signal.url) return `Found - ${signal.url}`;
    if (signal.placeName) {
      const rating = signal.rating ? ` (${signal.rating}★ / ${signal.reviewCount ?? 0})` : "";
      return `Found - ${signal.placeName}${rating}`;
    }
    return "Found";
  }
  return "Not found";
}

function signalVariant(signal?: Signal): "success" | "danger" | "neutral" {
  if (!signal || signal.checked === false) return "neutral";
  return signal.found ? "success" : "danger";
}

export function AuditReportPanel({ leadId, hasEmail, prospecting }: AuditPanelProps) {
  const [busy, setBusy] = useState<null | "generate" | "send">(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const classification = prospecting?.classification;
  const tier = classification?.category;
  const dp = prospecting?.digitalPresence;
  const status = prospecting?.prospectingStatus ?? "new";
  const hasReport = status === "reported" || status === "sent";

  async function call(kind: "generate" | "send") {
    setBusy(kind);
    setMessage(null);
    try {
      const url =
        kind === "generate"
          ? `/api/leads/${leadId}/audit-report`
          : `/api/leads/${leadId}/audit-report/send`;
      const res = await fetch(url, { method: "POST" });
      const body = await res.json();

      if (!res.ok) {
        setMessage({ kind: "error", text: body?.error?.message ?? `Request failed (${res.status})` });
        return;
      }

      setMessage({
        kind: "ok",
        text:
          kind === "generate"
            ? `Report generated - tier ${body.data.tier}, ${Math.round(body.data.bytes / 1024)} KB, text by ${body.data.paragraphSource}.`
            : `Sent to ${body.data.to} (${body.data.sentToday}/${body.data.dailyLimit} today).`,
      });
      // Server component data (status, tier) is stale after this.
      setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Request failed" });
    } finally {
      setBusy(null);
    }
  }

  if (!prospecting) {
    return (
      <p className="text-sm text-muted-foreground">
        This is an inbound lead - the digital-presence audit only applies to cold prospects.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-white p-3">
          <p className="text-xs text-muted-foreground">Audit Tier</p>
          <div className="mt-1">
            {isTier(tier) ? (
              <Badge variant={TIER_VARIANT[tier]}>
                Tier {tier} - {TIER_LABEL[tier]}
              </Badge>
            ) : (
              <span className="text-sm text-muted-foreground">Not classified yet</span>
            )}
          </div>
          {classification?.confidence ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {classification.signalsFound ?? 0} of {classification.signalsChecked ?? 0} checked
              channels found
              {classification.confidence === "partial"
                ? " - partial confidence, not every channel has been checked."
                : "."}
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-border bg-white p-3">
          <p className="text-xs text-muted-foreground">Audit Stage</p>
          <p className="mt-1 font-semibold text-foreground">{humanizeKey(status)}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Separate from the sales status above - this tracks the audit pipeline.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-white p-3">
        <p className="text-xs text-muted-foreground">Industry</p>
        {prospecting.industry ? (
          <>
            <p className="mt-1 font-semibold text-foreground">
              {humanizeKey(prospecting.industry)}
              {prospecting.segment ? (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  - {humanizeKey(prospecting.segment)}
                </span>
              ) : null}
            </p>
            {prospecting.industryConfidence ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant={CONFIDENCE_VARIANT[prospecting.industryConfidence] ?? "neutral"}>
                  {prospecting.industryConfidence}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {CONFIDENCE_HELP[prospecting.industryConfidence]}
                </span>
              </div>
            ) : null}
            {prospecting.industryMatchedOn ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Matched on {prospecting.industryMatchedOn}
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            {prospecting.unmappedIndustryLabel
              ? `"${prospecting.unmappedIndustryLabel}" has no knowledge-bank entry yet - the report will use generic copy.`
              : "Not determined - the report will use generic copy."}
          </p>
        )}
        {(prospecting.district || prospecting.state) && (
          <p className="mt-2 text-xs text-muted-foreground">
            {[prospecting.district, prospecting.state].filter(Boolean).join(", ")}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-border bg-white p-3">
        <p className="text-xs text-muted-foreground">Digital Presence Signals</p>
        <div className="mt-2 space-y-2 text-sm">
          {(
            [
              ["Website", dp?.website],
              ["Google Business", dp?.googleBusiness],
              ["Meta ads", dp?.metaAds],
            ] as Array<[string, Signal | undefined]>
          ).map(([label, signal]) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{label}</span>
              <Badge variant={signalVariant(signal)}>{signalText(signal)}</Badge>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Facebook Page</span>
            <Badge
              variant={
                !dp?.metaPresence?.checked
                  ? "neutral"
                  : dp.metaPresence.facebookFound
                    ? "success"
                    : "danger"
              }
            >
              {!dp?.metaPresence?.checked
                ? "Not yet checked"
                : dp.metaPresence.facebookFound
                  ? `Found${
                      typeof dp.metaPresence.facebookFollowers === "number"
                        ? ` - ${dp.metaPresence.facebookFollowers.toLocaleString("en-IN")} followers`
                        : ""
                    }`
                  : "Not found"}
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Technical SEO</span>
            <Badge
              variant={
                !dp?.technicalSeo?.checked
                  ? "neutral"
                  : (dp.technicalSeo.seoScore ?? 0) >= 70
                    ? "success"
                    : "danger"
              }
            >
              {dp?.technicalSeo?.checked
                ? `${dp.technicalSeo.seoScore ?? "-"}/100`
                : dp?.website?.found
                  ? "Not yet checked"
                  : "No site to audit"}
            </Badge>
          </div>
        </div>
        {dp?.technicalSeo?.checked && dp.technicalSeo.issues?.length ? (
          <ul className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
            {dp.technicalSeo.issues.map((issue) => (
              <li key={issue}>- {issue}</li>
            ))}
          </ul>
        ) : null}
        <div className="hidden">
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => call("generate")} disabled={busy !== null}>
          {busy === "generate" ? "Generating..." : hasReport ? "Regenerate Report" : "Generate Report"}
        </Button>
        <a
          href={`/api/leads/${leadId}/audit-report`}
          target="_blank"
          rel="noreferrer"
          className={`inline-flex h-11 items-center justify-center rounded-lg border border-border px-4 text-sm font-semibold transition-colors ${
            hasReport
              ? "bg-white text-foreground hover:bg-surface-soft"
              : "pointer-events-none bg-surface-soft text-muted-foreground"
          }`}
        >
          {hasReport ? "View PDF" : "No PDF Yet"}
        </a>
        <Button
          type="button"
          variant="secondary"
          onClick={() => call("send")}
          disabled={busy !== null || !hasReport || !hasEmail}
        >
          {busy === "send" ? "Sending..." : "Send To Lead"}
        </Button>
      </div>

      {!hasEmail ? (
        <p className="text-xs text-muted-foreground">
          Sending is disabled: this lead has no email address on file.
        </p>
      ) : null}
      {!isTier(tier) ? (
        <p className="text-xs text-muted-foreground">
          Report generation needs a classification first - a report must never assert a tier nobody
          measured.
        </p>
      ) : null}

      {message ? (
        <p className={`text-sm ${message.kind === "ok" ? "text-success" : "text-danger"}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
