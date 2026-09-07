// Structured JSON mirror of the audit-report PDF (report-template.tsx), for the public web view
// on nemnidhi-website (/audit-report/[shareToken]) - the "single-page attractive web view" that
// was scoped but never built when the PDF report itself was redesigned. Built from the exact same
// computeReportFacts() the PDF uses, so the two surfaces can never show different recommendations
// for the same lead.

import { computeReportFacts, DEPARTMENT_LABEL, TIER_LABEL, type ReportInput } from "./report-template";
import { AUTOMATION_FLOW, COMPANY, DEFAULT_PAIN_POINTS, PLATFORM_PILLARS, WHATSAPP_LINK } from "./report-config";

type FlowStepData = { title: string; subtitle: string | null };
const toFlowStepData = (steps: readonly (readonly [string, string | null])[]): FlowStepData[] =>
  steps.map(([title, subtitle]) => ({ title, subtitle }));

export type PublicAuditReportData = {
  businessName: string;
  location: string | null;
  hookText: string;
  tier: { category: string; label: string };
  paragraph: string;
  industryOutlook: string | null;
  digitalPresence: { label: string; value: string; isGap: boolean }[];
  seo: {
    score: number | null;
    performanceScore: number | null;
    mobileFriendly: boolean | null;
    issues: string[];
  } | null;
  painPoints: string;
  revenueLeaks: string[];
  departments: {
    key: string;
    label: string;
    items: { code: string; title: string; rationale: string }[];
  }[];
  productBrand: string | null;
  platformPillars: { title: string; body: string }[];
  company: { legalName: string; phone: string; email: string };
  whatsappLink: string;
  todayIntro: string;
  todayFlowStages: string[];
  automationFlow: {
    entryChain: FlowStepData[];
    interested: { label: string; steps: FlowStepData[] };
    noReply: { label: string; steps: FlowStepData[] };
  };
  generatedAt: string;
};

export function buildReportData({
  lead,
  enrichment,
  classification,
  paragraph,
  recommended,
  productBrand,
}: ReportInput): PublicAuditReportData {
  const facts = computeReportFacts({ lead, enrichment, recommended });
  const seo = enrichment.technicalSeo;

  return {
    businessName: lead.name,
    location: [lead.district, lead.state].filter(Boolean).join(", ") || null,
    hookText: facts.hookText,
    tier: { category: classification.category, label: TIER_LABEL[classification.category] },
    paragraph,
    industryOutlook: facts.industryOutlook,
    digitalPresence: facts.rows.map((row) => ({ ...row, isGap: facts.isGap(row) })),
    seo: seo?.checked
      ? {
          score: seo.seoScore ?? null,
          performanceScore: seo.performanceScore ?? null,
          mobileFriendly: typeof seo.isMobileFriendly === "boolean" ? seo.isMobileFriendly : null,
          issues: seo.issues ?? [],
        }
      : null,
    painPoints: lead.painPoints || facts.industryPainPoints || DEFAULT_PAIN_POINTS,
    revenueLeaks: facts.revenueLeaks,
    departments: facts.departmentGroups.map((group) => ({
      key: group.department,
      label: DEPARTMENT_LABEL[group.department],
      items: group.items.map((item) => ({ code: item.code, title: item.title, rationale: item.rationale })),
    })),
    productBrand,
    platformPillars: PLATFORM_PILLARS,
    company: { legalName: COMPANY.legalName, phone: COMPANY.phone, email: COMPANY.email },
    whatsappLink: WHATSAPP_LINK,
    todayIntro: facts.todayIntro,
    todayFlowStages: facts.todayFlowStages,
    automationFlow: {
      entryChain: toFlowStepData(AUTOMATION_FLOW.entryChain),
      interested: { label: AUTOMATION_FLOW.interested.label, steps: toFlowStepData(AUTOMATION_FLOW.interested.steps) },
      noReply: { label: AUTOMATION_FLOW.noReply.label, steps: toFlowStepData(AUTOMATION_FLOW.noReply.steps) },
    },
    generatedAt: new Date().toISOString(),
  };
}
