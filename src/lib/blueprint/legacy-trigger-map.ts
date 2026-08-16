import type { CatalogComponent } from "@/lib/pricing/smb-catalog";

/**
 * Bridges the questionnaire's trigger/decline codes (written against the old
 * 12-item smb-catalog.ts, e.g. "LEAD_MANAGEMENT", "WHATSAPP_CRM") to the real
 * migrated catalog (158 components, codes auto-generated from the pricing
 * sheet, e.g. "CRM_LEAD_MANAGEMENT_40000_8000"). The two were never the same
 * vocabulary - the old catalog had one generic component per concept; the
 * real catalog has several industry-specific variants of the same concept
 * (five different "inventory" products, one per industry group).
 *
 * A flat code-to-code alias would be wrong here: aliasing "INVENTORY" to a
 * single real code would show every industry the same (often mismatched)
 * inventory line item. Instead this matches by keyword AND by the real
 * component's own appliesToIndustries, so a Textile prospect gets Textile's
 * inventory product and a Construction prospect gets Construction's.
 *
 * This is a bridge, not a long-term answer - the honest fix is tagging each
 * real PricingComponent with the concept(s) it answers (the same way
 * answersGapTags already works for the audit-gap side of recommendations),
 * so questionnaire triggers and the catalog share one vocabulary instead of
 * being translated through keyword guesses. Flagged, not built here.
 */
const LEGACY_TRIGGER_KEYWORDS: Record<string, string[]> = {
  LEAD_MANAGEMENT: ["lead management", "crm"],
  WHATSAPP_CRM: ["whatsapp"],
  AUTOMATION_FLOWS: ["automation", "follow-up automation", "follow up automation"],
  INVENTORY: ["inventory"],
  BILLING_GST: ["invoice", "billing", "gst"],
  ECOMMERCE: ["online store", "ecommerce", "e-commerce", "online order", "online sales"],
  CLIENT_PORTAL_SMB: ["portal"],
  MOBILE_APP: ["mobile app"],
};

function suitsIndustry(component: CatalogComponent, industry?: string | null) {
  if (component.appliesToIndustries.length === 0) return true;
  return Boolean(industry) && component.appliesToIndustries.includes(industry!);
}

function matchesKeywords(component: CatalogComponent, keywords: string[]) {
  const haystack = component.title.toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword));
}

/**
 * Resolves a list of legacy or real codes into real catalog codes. A code
 * that's already real (an exact match in the catalog) passes through
 * untouched - this only translates the old vocabulary, it doesn't second-
 * guess a real code the caller already knows about.
 */
export function resolveToRealCatalogCodes(
  codes: string[],
  catalog: CatalogComponent[],
  industry?: string | null,
): string[] {
  const realCodes = new Set(catalog.map((c) => c.code));
  const resolved = new Set<string>();

  for (const code of codes) {
    if (realCodes.has(code)) {
      resolved.add(code);
      continue;
    }

    const keywords = LEGACY_TRIGGER_KEYWORDS[code];
    if (!keywords) continue;

    const match = catalog.find((component) => matchesKeywords(component, keywords) && suitsIndustry(component, industry));
    if (match) resolved.add(match.code);
  }

  return [...resolved];
}
