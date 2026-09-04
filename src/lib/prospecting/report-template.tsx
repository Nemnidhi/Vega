// Report PDF template for the digital-presence audit.
//
// Ported from Samvid, where this existed as TWO files kept manually in sync -
// an ESM .tsx for the Next API routes and a CommonJS mirror for the CLI
// scripts, because @react-pdf/renderer is ESM-only and a plain require() of
// it broke webpack. Vega runs scripts through tsx against the same module
// graph, so that split is gone: this is the only copy.
//
// Company details and pricing live in report-config.ts - edit values there.

import { Document, Page, View, Text, Image, Link, StyleSheet, Svg, Path } from "@react-pdf/renderer";
import QRCode from "qrcode";

// Nemnidhi's real brand teal (the logo mark's color, --color-accent on the site) - used
// everywhere this report used to fall back to a generic indigo/gray template palette that had
// nothing to do with the actual brand.
const BRAND_TEAL = "#0891b2";
const BRAND_TEAL_DARK = "#0e7490";
const BRAND_TEAL_TINT = "#ecfeff";
const LOGO_URL = "https://nemnidhi.com/images/logo.png";
import {
  COMPANY,
  WHO_WE_ARE,
  PRIVACY_NOTE,
  DEFAULT_PAIN_POINTS,
  AUTOMATION_FLOW,
  CLOSING_CTA,
  RESPONSE_TIME_NOTE,
  WHATSAPP_LINK,
  NEXT_STEPS,
  type FlowStep,
} from "@/lib/prospecting/report-config";
import {
  getIndustryPainPointsText,
  getRevenueLeaks,
  getIndustryOutlookLine,
  getCurrentFlowStages,
  getResolvedLabel,
} from "@/lib/prospecting/industry-knowledge";
import type { ClassificationResult, EnrichmentSignals, ProspectSubject } from "@/lib/prospecting/types";
import type { RecommendedComponent } from "@/lib/blueprint/recommend";
import type { PricingDepartment } from "@/types/pricing-component";

// Maps Digital Presence Audit row labels to the gap category the industry
// knowledge-bank's pain-point/revenue-leak narrative is tagged against - a
// narrower, older 2-tag vocabulary (website/social) than the 4-tag one
// (website/google/seo/social) recommendComponents uses below, because that
// narrative content was written before the finer-grained tags existed and
// re-tagging hundreds of knowledge-bank entries is out of scope here. Kept
// deliberately small and honest either way: only tag against gaps actually
// measured, not operational issues with no real signal behind them.
const ROW_TO_GAP_TAG: Record<string, string> = {
  Website: "website",
  "Technical SEO": "website",
  "Google Business profile": "website",
  "Meta ad activity": "social",
};

export const DEPARTMENT_LABEL: Record<PricingDepartment, string> = {
  sales: "Sales",
  marketing: "Marketing",
  operations: "Operations",
  billing: "Billing",
};

const DEPARTMENT_ORDER: PricingDepartment[] = ["marketing", "sales", "operations", "billing"];

export const TIER_LABEL: Record<string, string> = {
  A: "No digital presence found",
  B: "Minimal digital presence",
  C: "Partial digital presence",
  D: "Strong digital presence",
};

const TIER_COLOR: Record<string, string> = {
  A: "#b91c1c",
  B: "#c2410c",
  C: "#a16207",
  D: "#15803d",
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    paddingBottom: 56,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: "#18181b",
  },
  header: {
    marginBottom: 16,
    borderBottom: `2 solid ${BRAND_TEAL}`,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  logo: {
    width: 26,
    height: 26,
  },
  brand: {
    fontSize: 10,
    color: "#71717a",
    marginBottom: 4,
  },
  businessName: {
    fontSize: 20,
    fontWeight: 700,
  },
  location: {
    fontSize: 11,
    color: "#52525b",
    marginTop: 2,
  },
  hook: {
    fontSize: 13,
    fontWeight: 700,
    color: "#b91c1c",
    marginTop: 10,
  },
  leakIntro: {
    fontSize: 10.5,
    color: "#3f3f46",
    marginTop: 8,
    marginBottom: 6,
  },
  leakRow: {
    flexDirection: "row",
    paddingVertical: 3,
  },
  leakBullet: {
    width: 12,
    fontSize: 10,
    color: "#b91c1c",
    fontWeight: 700,
  },
  leakText: {
    flex: 1,
    fontSize: 10,
    color: "#27272a",
  },
  companyBox: {
    marginBottom: 18,
    padding: 10,
    borderRadius: 4,
    backgroundColor: "#f4f4f5",
  },
  companyText: {
    fontSize: 9.5,
    lineHeight: 1.5,
    color: "#3f3f46",
  },
  companyMeta: {
    fontSize: 8.5,
    color: "#71717a",
    marginTop: 6,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 8,
    textTransform: "uppercase",
    color: BRAND_TEAL_DARK,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottom: "1 solid #e4e4e7",
  },
  rowLabel: {
    fontSize: 11,
  },
  rowValue: {
    fontSize: 11,
    fontWeight: 700,
  },
  badge: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 6,
  },
  paragraph: {
    fontSize: 11,
    lineHeight: 1.5,
    color: "#27272a",
  },
  industryOutlook: {
    fontSize: 9,
    lineHeight: 1.4,
    color: "#71717a",
    fontStyle: "italic",
    marginTop: 6,
  },
  screenshot: {
    marginTop: 6,
    maxWidth: 240,
    border: "1 solid #e4e4e7",
  },
  competitorRow: {
    paddingVertical: 4,
    fontSize: 10,
    color: "#27272a",
  },
  testimonialBox: {
    marginBottom: 8,
    padding: 10,
    borderRadius: 4,
    backgroundColor: "#f4f4f5",
  },
  testimonialQuote: {
    fontSize: 10,
    fontStyle: "italic",
    lineHeight: 1.4,
    color: "#27272a",
  },
  testimonialAuthor: {
    fontSize: 8.5,
    color: "#71717a",
    marginTop: 4,
  },
  deptChart: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    height: 70,
    marginVertical: 10,
    paddingHorizontal: 10,
  },
  deptChartCol: {
    alignItems: "center",
  },
  deptChartCount: {
    fontSize: 11,
    fontWeight: 700,
    color: "#3f3f46",
    marginBottom: 3,
  },
  deptChartTrack: {
    width: 22,
    height: 40,
    backgroundColor: "#e4e4e7",
    borderRadius: 3,
    justifyContent: "flex-end",
  },
  deptChartFill: {
    width: "100%",
    backgroundColor: BRAND_TEAL,
    borderRadius: 3,
  },
  deptChartLabel: {
    fontSize: 8,
    color: "#71717a",
    marginTop: 4,
    textAlign: "center",
  },
  deptSection: {
    marginTop: 10,
  },
  deptSectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: BRAND_TEAL_DARK,
    textTransform: "uppercase",
    marginBottom: 6,
    paddingBottom: 3,
    borderBottom: `1 solid ${BRAND_TEAL}`,
  },
  deptItem: {
    marginBottom: 7,
  },
  deptItemTitle: {
    fontSize: 10.5,
    fontWeight: 700,
    color: "#18181b",
  },
  deptItemRationale: {
    fontSize: 9.5,
    color: "#52525b",
    marginTop: 1,
    lineHeight: 1.4,
  },
  appendixKicker: {
    fontSize: 9,
    color: BRAND_TEAL,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  appendixHeading: {
    fontSize: 18,
    fontWeight: 700,
    color: "#18181b",
    marginBottom: 10,
  },
  appendixIntro: {
    fontSize: 10.5,
    lineHeight: 1.5,
    color: "#3f3f46",
    marginBottom: 18,
  },
  pillarRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  pillarMark: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BRAND_TEAL,
    marginTop: 4,
    marginRight: 8,
  },
  pillarTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: "#18181b",
  },
  pillarBody: {
    fontSize: 9.5,
    color: "#52525b",
    marginTop: 2,
    lineHeight: 1.4,
  },
  brandBox: {
    marginTop: 12,
    padding: 14,
    borderRadius: 4,
    border: `1 solid ${BRAND_TEAL}`,
    backgroundColor: BRAND_TEAL_TINT,
  },
  brandKicker: {
    fontSize: 8.5,
    color: BRAND_TEAL_DARK,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  brandName: {
    fontSize: 13,
    fontWeight: 700,
    color: BRAND_TEAL_DARK,
  },
  brandBody: {
    fontSize: 9.5,
    color: "#52525b",
    marginTop: 4,
    lineHeight: 1.4,
  },
  flowRowWrap: {
    marginBottom: 8,
  },
  flowBranchLabel: {
    fontSize: 8.5,
    fontStyle: "italic",
    color: "#71717a",
    marginBottom: 4,
  },
  flowSubheading: {
    fontSize: 9.5,
    fontWeight: 700,
    color: "#27272a",
    marginBottom: 4,
    marginTop: 2,
  },
  todayIntro: {
    fontSize: 9,
    color: "#52525b",
    marginBottom: 6,
  },
  flowChain: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    rowGap: 6,
  },
  flowBox: {
    minWidth: 110,
    maxWidth: 140,
    padding: 6,
    borderRadius: 5,
    border: "1 solid #d4d4d8",
  },
  flowBoxEntry: {
    backgroundColor: BRAND_TEAL_TINT,
    borderColor: BRAND_TEAL,
  },
  flowBoxToday: {
    backgroundColor: "#fafafa",
    borderColor: "#d4d4d8",
  },
  flowBoxInterested: {
    backgroundColor: "#f0fdf4",
    borderColor: "#22c55e",
  },
  flowBoxNoReply: {
    backgroundColor: "#fffbeb",
    borderColor: "#d97706",
  },
  flowBoxTitle: {
    fontSize: 8.5,
    fontWeight: 700,
    textAlign: "center",
    color: "#27272a",
  },
  flowBoxSubtitle: {
    fontSize: 7,
    textAlign: "center",
    color: "#71717a",
    marginTop: 2,
  },
  flowArrowWrap: {
    marginHorizontal: 3,
  },
  nextStepRow: {
    flexDirection: "row",
    marginBottom: 5,
  },
  nextStepNumber: {
    width: 16,
    fontSize: 10,
    fontWeight: 700,
    color: BRAND_TEAL_DARK,
  },
  nextStepText: {
    flex: 1,
    fontSize: 10,
    color: "#27272a",
  },
  ctaBox: {
    marginTop: 4,
    padding: 12,
    borderRadius: 4,
    backgroundColor: "#fdf9ef",
    border: "1 solid #d6be7c",
    flexDirection: "row",
    alignItems: "center",
  },
  ctaTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  ctaText: {
    fontSize: 11,
    lineHeight: 1.5,
    color: "#7a5f1f",
    fontWeight: 700,
  },
  ctaResponseTime: {
    fontSize: 9,
    color: "#8a6d2a",
    marginTop: 6,
    fontWeight: 400,
  },
  ctaQr: {
    width: 64,
    height: 64,
  },
  ctaQrCaption: {
    fontSize: 7,
    color: "#4338ca",
    textAlign: "center",
    marginTop: 3,
    width: 64,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#a1a1aa",
    borderTop: "1 solid #e4e4e7",
    paddingTop: 6,
  },
});

type Channel = { checked?: boolean; found?: boolean | null };

function statusLabel(channel: Channel) {
  if (channel.checked === false) return "Not yet checked";
  return channel.found ? "Found" : "Not found";
}

// A real drawn arrowhead (react-pdf renders Svg/Path natively) - replaces the old plain "->"
// text glyph, which read as unfinished rather than designed.
function FlowArrow({ color = BRAND_TEAL }: { color?: string }) {
  return (
    <View style={styles.flowArrowWrap}>
      <Svg width={14} height={9} viewBox="0 0 14 9">
        <Path d="M0 4.5 H10 M6 0.5 L10 4.5 L6 8.5" stroke={color} strokeWidth={1.4} fill="none" />
      </Svg>
    </View>
  );
}

function FlowBox({
  title,
  subtitle,
  variant,
}: {
  title: string;
  subtitle?: string | null;
  variant: "entry" | "interested" | "noReply" | "today";
}) {
  const variantStyle =
    variant === "entry"
      ? styles.flowBoxEntry
      : variant === "today"
        ? styles.flowBoxToday
        : variant === "interested"
          ? styles.flowBoxInterested
          : styles.flowBoxNoReply;
  return (
    <View style={[styles.flowBox, variantStyle]}>
      <Text style={styles.flowBoxTitle}>{title}</Text>
      {subtitle ? <Text style={styles.flowBoxSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function FlowChain({
  steps,
  variant,
}: {
  steps: FlowStep[];
  variant: "entry" | "interested" | "noReply" | "today";
}) {
  const arrowColor = variant === "today" ? "#a1a1aa" : BRAND_TEAL;
  return (
    <View style={styles.flowChain}>
      {steps.map(([title, subtitle], i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center" }}>
          {i > 0 ? <FlowArrow color={arrowColor} /> : null}
          <FlowBox title={title} subtitle={subtitle} variant={variant} />
        </View>
      ))}
    </View>
  );
}

// Was a wrapped row of plain numbered pills - now the same connected-chain treatment
// FlowChain uses below it, so the two diagrams on this page read as one design, not two.
function TodayFlow({ stages }: { stages: string[] }) {
  const steps: FlowStep[] = stages.map((stage, i) => [`${i + 1}. ${stage}`, null]);
  return <FlowChain steps={steps} variant="today" />;
}

export type Competitor = {
  name: string;
  channelsFound: string[];
};

export type Testimonial = {
  quote: string;
  author: string;
  business?: string;
};

export type ReportInput = {
  lead: ProspectSubject;
  enrichment: EnrichmentSignals;
  classification: ClassificationResult;
  paragraph: string;
  // Real gap -> feature matches from the pricing catalog (recommendComponents), department-
  // grouped below. Deliberately never reads price fields off these - see the department section
  // for why.
  recommended: RecommendedComponent[];
  // "Samvid OS" for real estate, "<Industry> OS" elsewhere (getProductBrand) - null only when the
  // lead has no resolved industry at all, in which case the appendix page is skipped rather than
  // showing a brand for an industry nobody confirmed.
  productBrand: string | null;
  // Only rendered once an enrichment step actually produces this - omitted today.
  searchScreenshotUrl?: string;
  // Only rendered once nearby-competitor lookups are wired up - omitted today.
  competitors?: Competitor[];
  // Only rendered once real client testimonials exist - never fill with placeholder quotes.
  testimonials?: Testimonial[];
};

/**
 * Everything the PDF template and the public JSON web-view both need, computed once so the two
 * surfaces can never drift apart. Pulled out of buildReportDocument unchanged - same inputs, same
 * outputs, just shared now instead of only living inside the PDF's JSX builder.
 */
export function computeReportFacts({
  lead,
  enrichment,
  recommended,
}: Pick<ReportInput, "lead" | "enrichment" | "recommended">) {
  const seo = enrichment.technicalSeo;
  const rows: { label: string; value: string }[] = [
    { label: "Website", value: statusLabel({ checked: true, found: enrichment.website?.found }) },
    {
      label: "Technical SEO",
      value: !enrichment.website?.found
        ? "No site to audit"
        : seo?.checked
          ? `Scored ${seo.seoScore ?? "-"}/100`
          : "Not yet checked",
    },
  ];
  if (enrichment.googleBusiness) {
    rows.push({ label: "Google Business profile", value: statusLabel(enrichment.googleBusiness) });
  }
  if (enrichment.metaAds) {
    rows.push({ label: "Meta ad activity", value: statusLabel(enrichment.metaAds) });
  }

  // A site that exists but scores badly is still a gap we can fix - it just
  // isn't an *absence*, so it must not inflate the "no active presence"
  // count in the hook line below.
  const isGap = (row: { label: string; value: string }) =>
    row.value === "Not found" ||
    (row.label === "Technical SEO" && Boolean(seo?.checked) && (seo?.seoScore ?? 100) < 70);

  const missingTags = rows
    .filter(isGap)
    .map((r) => ROW_TO_GAP_TAG[r.label])
    .filter((t): t is string => Boolean(t));
  // Segment resolution hint: an explicit lead.segment always wins (manual
  // override); otherwise inferred from whatever business-category-like text
  // is available. Only matters for industries with a `segments` shape -
  // ignored for flat/unsegmented ones.
  const segmentHint = {
    segment: lead.segment,
    text: lead.businessCategory || lead.entityType || lead.name,
  };
  const industryPainPoints = getIndustryPainPointsText(lead.industry, missingTags, segmentHint);
  const industryOutlook = getIndustryOutlookLine(lead.industry);
  const revenueLeaks = getRevenueLeaks(lead.industry, missingTags, segmentHint);
  const resolvedLabel = getResolvedLabel(lead.industry, segmentHint);
  const todayFlowStages = getCurrentFlowStages(lead.industry, segmentHint);
  const todayIntro = resolvedLabel
    ? `How a ${resolvedLabel.toLowerCase()} business like this typically runs today:`
    : "How a business like this typically runs today:";
  const missingCount = rows.filter((r) => r.value === "Not found").length;
  const hookText =
    missingCount > 0
      ? `${missingCount} of ${rows.length} channels we checked show no active presence.`
      : "Your core digital presence is solid - the real opportunity is in what happens after someone finds you.";
  const generatedOn = new Date().toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const departmentGroups = DEPARTMENT_ORDER.map((department) => ({
    department,
    items: recommended.filter((component) => component.department === department),
  })).filter((group) => group.items.length > 0);
  const maxDepartmentCount = Math.max(1, ...departmentGroups.map((g) => g.items.length));

  return {
    rows,
    isGap,
    missingTags,
    industryPainPoints,
    industryOutlook,
    revenueLeaks,
    resolvedLabel,
    todayFlowStages,
    todayIntro,
    missingCount,
    hookText,
    generatedOn,
    departmentGroups,
    maxDepartmentCount,
  };
}

export async function buildReportDocument({
  lead,
  enrichment,
  classification,
  paragraph,
  recommended,
  productBrand,
  searchScreenshotUrl,
  competitors = [],
  testimonials = [],
}: ReportInput) {
  const whatsappQrDataUrl = await QRCode.toDataURL(WHATSAPP_LINK, { margin: 1, width: 128 });
  const seo = enrichment.technicalSeo;

  const {
    rows,
    industryPainPoints,
    industryOutlook,
    revenueLeaks,
    todayFlowStages,
    todayIntro,
    hookText,
    generatedOn,
    departmentGroups,
    maxDepartmentCount,
  } = computeReportFacts({ lead, enrichment, recommended });

  return (
    <Document title={`${lead.name} - Digital Presence Report`}>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.brand}>DIGITAL PRESENCE AUDIT</Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={LOGO_URL} style={styles.logo} />
          </View>
          <Text style={styles.businessName}>{lead.name}</Text>
          <Text style={styles.location}>{[lead.district, lead.state].filter(Boolean).join(", ")}</Text>
          <Text style={styles.hook}>{hookText}</Text>
        </View>

        <View style={styles.companyBox}>
          <Text style={styles.companyText}>{WHO_WE_ARE}</Text>
          <Text style={styles.companyMeta}>
            {COMPANY.legalName} · GST {COMPANY.gst} · {COMPANY.address}
          </Text>
          <Text style={styles.companyMeta}>
            {COMPANY.phone} · {COMPANY.email}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Digital Presence Summary</Text>
          {rows.map((row, i) => (
            <View style={styles.row} key={i}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowValue}>{row.value}</Text>
            </View>
          ))}
        </View>

        {seo?.checked ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Website Health</Text>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Search engine optimisation</Text>
              <Text style={styles.rowValue}>{seo.seoScore ?? "-"}/100</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Loading speed</Text>
              <Text style={styles.rowValue}>{seo.performanceScore ?? "-"}/100</Text>
            </View>
            {typeof seo.isMobileFriendly === "boolean" ? (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Works properly on mobile</Text>
                <Text style={styles.rowValue}>{seo.isMobileFriendly ? "Yes" : "No"}</Text>
              </View>
            ) : null}
            {seo.issues && seo.issues.length > 0 ? (
              <>
                <Text style={styles.leakIntro}>
                  What we found on your site, measured with Google&apos;s own tooling:
                </Text>
                {seo.issues.map((issue, i) => (
                  <View style={styles.leakRow} key={i}>
                    <Text style={styles.leakBullet}>{"-"}</Text>
                    <Text style={styles.leakText}>{issue}</Text>
                  </View>
                ))}
              </>
            ) : null}
          </View>
        ) : null}

        {searchScreenshotUrl ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What Customers See</Text>
            <Text style={styles.paragraph}>Search result for &quot;{lead.name}&quot;:</Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={searchScreenshotUrl} style={styles.screenshot} />
          </View>
        ) : null}

        {competitors.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How You Compare Nearby</Text>
            {competitors.map((c, i) => (
              <Text style={styles.competitorRow} key={i}>
                {c.name}: {c.channelsFound.length > 0 ? c.channelsFound.join(", ") : "no presence found"}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Assessment</Text>
          <Text style={[styles.badge, { backgroundColor: TIER_COLOR[classification.category] }]}>
            {`Tier ${classification.category}: ${TIER_LABEL[classification.category]}`}
          </Text>
          <Text style={styles.paragraph}>{paragraph}</Text>
          {industryOutlook ? <Text style={styles.industryOutlook}>{industryOutlook}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How This Plays Out Today</Text>
          <Text style={styles.paragraph}>{lead.painPoints || industryPainPoints || DEFAULT_PAIN_POINTS}</Text>
          <Text style={styles.leakIntro}>
            Common revenue leaks for businesses in this position, not specific to any one company:
          </Text>
          {revenueLeaks.map((leak, i) => (
            <View style={styles.leakRow} key={i}>
              <Text style={styles.leakBullet}>{"-"}</Text>
              <Text style={styles.leakText}>{leak}</Text>
            </View>
          ))}
        </View>

        {departmentGroups.length > 0 ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Recommended For Your Business</Text>
            <Text style={styles.leakIntro}>
              {recommended.length} thing{recommended.length === 1 ? "" : "s"} worth building, grouped by who at
              Nemnidhi does the work - matched only against what this audit actually measured, nothing generic.
            </Text>

            <View style={styles.deptChart}>
              {departmentGroups.map((group) => (
                <View key={group.department} style={styles.deptChartCol}>
                  <Text style={styles.deptChartCount}>{group.items.length}</Text>
                  <View style={styles.deptChartTrack}>
                    <View
                      style={[
                        styles.deptChartFill,
                        { height: `${Math.round((group.items.length / maxDepartmentCount) * 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.deptChartLabel}>{DEPARTMENT_LABEL[group.department]}</Text>
                </View>
              ))}
            </View>

            {departmentGroups.map((group) => (
              <View key={group.department} style={styles.deptSection} wrap={false}>
                <Text style={styles.deptSectionTitle}>{DEPARTMENT_LABEL[group.department]}</Text>
                {group.items.map((component) => (
                  <View key={component.code} style={styles.deptItem}>
                    <Text style={styles.deptItemTitle}>{component.title}</Text>
                    <Text style={styles.deptItemRationale}>{component.rationale}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What It Looks Like Solved</Text>

          <Text style={styles.flowSubheading}>Today</Text>
          <Text style={styles.todayIntro}>{todayIntro}</Text>
          <TodayFlow stages={todayFlowStages} />

          <Text style={styles.flowSubheading}>Where Automation Plugs In</Text>
          <View style={styles.flowRowWrap}>
            <FlowChain steps={AUTOMATION_FLOW.entryChain} variant="entry" />
          </View>
          <View style={styles.flowRowWrap}>
            <Text style={styles.flowBranchLabel}>{AUTOMATION_FLOW.interested.label}</Text>
            <FlowChain steps={AUTOMATION_FLOW.interested.steps} variant="interested" />
          </View>
          <View style={styles.flowRowWrap}>
            <Text style={styles.flowBranchLabel}>{AUTOMATION_FLOW.noReply.label}</Text>
            <FlowChain steps={AUTOMATION_FLOW.noReply.steps} variant="noReply" />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data & Privacy</Text>
          <Text style={styles.paragraph}>
            {PRIVACY_NOTE} Report generated on {generatedOn}.
          </Text>
        </View>

        {testimonials.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What Clients Say</Text>
            {testimonials.map((t, i) => (
              <View style={styles.testimonialBox} key={i}>
                <Text style={styles.testimonialQuote}>&quot;{t.quote}&quot;</Text>
                <Text style={styles.testimonialAuthor}>
                  {t.author}
                  {t.business ? `, ${t.business}` : ""}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What Happens Next</Text>
          {NEXT_STEPS.map((step, i) => (
            <View style={styles.nextStepRow} key={i}>
              <Text style={styles.nextStepNumber}>{i + 1}.</Text>
              <Text style={styles.nextStepText}>{step}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.ctaBox}>
            <View style={styles.ctaTextCol}>
              <Text style={styles.ctaText}>{CLOSING_CTA}</Text>
              <Text style={styles.ctaResponseTime}>{RESPONSE_TIME_NOTE}</Text>
            </View>
            <View>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={whatsappQrDataUrl} style={styles.ctaQr} />
              <Link src={WHATSAPP_LINK} style={styles.ctaQrCaption}>
                Scan or tap to chat
              </Link>
            </View>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          {COMPANY.legalName} · GST {COMPANY.gst} · {COMPANY.email} · Based on publicly available information.
        </Text>
      </Page>

      {productBrand ? (
        <Page size="A4" style={styles.page} wrap>
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={styles.appendixKicker}>Appendix - What {productBrand} Includes</Text>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={LOGO_URL} style={styles.logo} />
            </View>
          </View>

          <Text style={styles.appendixHeading}>One connected platform, not five separate tools</Text>
          <Text style={styles.appendixIntro}>
            Everything recommended on the pages above comes from the same five-pillar platform - built and run by
            Nemnidhi, not stitched together from outside vendors.
          </Text>

          <View style={styles.pillarRow}>
            <View style={styles.pillarMark} />
            <View>
              <Text style={styles.pillarTitle}>CRM &amp; Client Management</Text>
              <Text style={styles.pillarBody}>
                One place to track every lead, proposal, client and project from first contact to delivery.
              </Text>
            </View>
          </View>
          <View style={styles.pillarRow}>
            <View style={styles.pillarMark} />
            <View>
              <Text style={styles.pillarTitle}>WhatsApp Business Automation</Text>
              <Text style={styles.pillarBody}>
                A shared team inbox with automated replies, broadcast campaigns and catalog &amp; order sharing - the
                channel your customers already use.
              </Text>
            </View>
          </View>
          <View style={styles.pillarRow}>
            <View style={styles.pillarMark} />
            <View>
              <Text style={styles.pillarTitle}>AI Assistance</Text>
              <Text style={styles.pillarBody}>
                AI-drafted replies, lead scoring, and automation flows that handle repetitive conversations.
              </Text>
            </View>
          </View>
          <View style={styles.pillarRow}>
            <View style={styles.pillarMark} />
            <View>
              <Text style={styles.pillarTitle}>Websites &amp; Digital Presence</Text>
              <Text style={styles.pillarBody}>
                A fast, SEO-ready website with lead capture and click-to-WhatsApp ad integration.
              </Text>
            </View>
          </View>
          <View style={styles.pillarRow}>
            <View style={styles.pillarMark} />
            <View>
              <Text style={styles.pillarTitle}>Billing, Invoicing &amp; Compliance</Text>
              <Text style={styles.pillarBody}>
                GST-ready invoicing, subscription billing and financial reporting, sold standalone or as part of the
                full platform.
              </Text>
            </View>
          </View>

          <View style={styles.brandBox}>
            <Text style={styles.brandKicker}>Built On</Text>
            <Text style={styles.brandName}>{productBrand}</Text>
            <Text style={styles.brandBody}>
              A pack tier (Basic, Medium, Pro, or fully Custom) sets how much of this is switched on for your
              business and budget - the platform underneath is the same one either way.
            </Text>
          </View>

          <Text style={styles.footer} fixed>
            {COMPANY.legalName} · GST {COMPANY.gst} · {COMPANY.email} · Based on publicly available information.
          </Text>
        </Page>
      ) : null}
    </Document>
  );
}
