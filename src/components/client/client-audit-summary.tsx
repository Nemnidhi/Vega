import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TIER_LABEL, TIER_VARIANT, humanizeKey, isTier } from "@/lib/prospecting/tier-display";

type Signal = {
  checked?: boolean;
  found?: boolean | null;
  url?: string | null;
};

export type ClientAuditSummaryProps = {
  leadId: string;
  prospecting?: {
    industry?: string;
    segment?: string;
    prospectingStatus?: string;
    digitalPresence?: {
      website?: Signal;
      googleBusiness?: Signal;
      metaAds?: Signal;
    };
    classification?: {
      category?: string;
    };
  } | null;
};

function signalText(signal?: Signal) {
  if (!signal || signal.checked === false) return "Not yet checked";
  return signal.found ? "Found" : "Not found";
}

function signalVariant(signal?: Signal): "success" | "danger" | "neutral" {
  if (!signal || signal.checked === false) return "neutral";
  return signal.found ? "success" : "danger";
}

export function ClientAuditSummary({ leadId, prospecting }: ClientAuditSummaryProps) {
  if (!prospecting) {
    return null;
  }

  const tier = prospecting.classification?.category;
  const dp = prospecting.digitalPresence;
  const status = prospecting.prospectingStatus ?? "new";
  const hasReport = status === "reported" || status === "sent";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Digital Presence Audit</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          {isTier(tier) ? (
            <Badge variant={TIER_VARIANT[tier]}>
              Tier {tier} - {TIER_LABEL[tier]}
            </Badge>
          ) : (
            <span className="text-sm text-muted-foreground">Audit still in progress.</span>
          )}
        </div>

        {prospecting.industry ? (
          <p className="text-sm text-muted-foreground">
            {humanizeKey(prospecting.industry)}
            {prospecting.segment ? ` - ${humanizeKey(prospecting.segment)}` : ""}
          </p>
        ) : null}

        <div className="space-y-2 text-sm">
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
        </div>

        {hasReport ? (
          <a
            href={`/api/leads/${leadId}/audit-report`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-white px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-soft"
          >
            Download Your Report
          </a>
        ) : (
          <p className="text-xs text-muted-foreground">Your full report isn&apos;t ready yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
