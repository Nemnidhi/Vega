/**
 * Component catalog for the SMB / cold-outreach side of the business.
 *
 * ⚠ EVERY PRICE HERE IS DERIVED, NOT CONFIRMED. Each entry records where its
 * number came from so the guesses are visible and correctable. Nothing here
 * should be quoted to a client until the delivery costs are confirmed - the
 * same rule the industry knowledge bank follows for its figures.
 *
 * Provenance of the anchors, from src/lib/prospecting/report-config.ts, which
 * is the pricing already printed in every audit report sent to a prospect:
 *
 *   Starter   Rs  8,000 - 15,000  + Rs 1,500 -  3,000/mo   website only
 *   Growth    Rs 15,000 - 30,000  + Rs 5,000 -  8,000/mo   + WhatsApp CRM + basic automation
 *   Complete  Rs 30,000 - 60,000  + Rs 10,000 - 15,000/mo  + full automation + ops system
 *
 * ⚠ These are an order of magnitude below Vega's existing pricing catalog
 * (seed-data.ts), where a single component starts at Rs 1,20,000. Those were
 * written for a bespoke legal-tech build. Both are probably right for their
 * own audience, which is why components carry a `scaleTier` - but somebody
 * needs to confirm that, because a blueprint drawing from the wrong tier
 * would quote an eight-fold error.
 *
 * `basePrice` is the delivery cost BEFORE margin. The pricing engine applies
 * the margin floor, so these are deliberately the cost side, not the sticker.
 */
import type { ComponentFeature, PricingCategory, PricingDepartment } from "@/types/pricing-component";

export type ScaleTier = "smb" | "midmarket" | "enterprise";

export interface CatalogComponent {
  code: string;
  title: string;
  description: string;
  category: PricingCategory;
  /**
   * Client-facing department grouping (Sales/Marketing/Operations/Billing).
   * Optional here because this placeholder catalog predates the field and
   * hasn't had a real classification pass - recommendComponents() falls
   * back to "operations" where it's missing. The real DB-backed catalog
   * (catalog-source.ts) always sets it.
   */
  department?: PricingDepartment;
  basePrice: number;
  complexityMultiplier: number;
  marginPercentage: number;
  monthlyPrice: number;
  deliveryWeeksMin: number;
  deliveryWeeksMax: number;
  answersGapTags: string[];
  appliesToIndustries: string[];
  scaleTiers: ScaleTier[];
  features: ComponentFeature[];
  /** Where the numbers came from. Kept in the data so it survives review. */
  priceBasis: string;
}

export const smbCatalog: CatalogComponent[] = [
  {
    code: "WEB_PRESENCE",
    title: "Website",
    description:
      "A website that lets a customer find you, understand what you do, and get in touch.",
    category: "website",
    basePrice: 7000,
    complexityMultiplier: 1.1,
    marginPercentage: 32,
    monthlyPrice: 1500,
    deliveryWeeksMin: 2,
    deliveryWeeksMax: 4,
    answersGapTags: ["website"],
    appliesToIndustries: [],
    scaleTiers: ["smb"],
    priceBasis: "Starter tier, published report pricing (Rs 8,000-15,000 one-time)",
    features: [
      { code: "PAGES_CORE", label: "Core pages (home, about, services, contact)", priceImpact: 0, isDefault: true },
      { code: "CATALOG", label: "Product or service catalogue", description: "Browsable listings without checkout.", priceImpact: 6000, isDefault: false },
      { code: "ENQUIRY_FORM", label: "Enquiry form feeding the CRM", priceImpact: 2500, isDefault: true },
      { code: "MULTILINGUAL", label: "Second language", priceImpact: 5000, isDefault: false },
    ],
  },
  {
    code: "ECOMMERCE",
    title: "Online store",
    description: "Sell directly online, with payments, orders and delivery status.",
    category: "website",
    basePrice: 28000,
    complexityMultiplier: 1.25,
    marginPercentage: 30,
    monthlyPrice: 4000,
    deliveryWeeksMin: 5,
    deliveryWeeksMax: 9,
    answersGapTags: ["website"],
    appliesToIndustries: [
      "textile_apparel", "leather_footwear", "food_processing", "trade_services",
      "paper_packaging", "electronics_electricals", "automobile_auto_components",
    ],
    scaleTiers: ["smb", "midmarket"],
    priceBasis: "Between Complete tier one-time (Rs 30,000-60,000) and a custom build. UNVERIFIED",
    features: [
      { code: "PAYMENTS", label: "Online payments", priceImpact: 0, isDefault: true },
      { code: "COD", label: "Cash on delivery", priceImpact: 2000, isDefault: false },
      { code: "SHIPPING_INT", label: "Courier integration", priceImpact: 6000, isDefault: false },
      { code: "GST_INVOICE", label: "GST invoice per order", priceImpact: 5000, isDefault: true, requires: ["PAYMENTS"] },
    ],
  },
  {
    code: "GOOGLE_PRESENCE",
    title: "Google Business setup and optimisation",
    description:
      "Claim and complete the Google Business profile so the business appears in local search and Maps.",
    category: "intake",
    basePrice: 3000,
    complexityMultiplier: 1,
    marginPercentage: 40,
    monthlyPrice: 1200,
    deliveryWeeksMin: 1,
    deliveryWeeksMax: 1,
    answersGapTags: ["google"],
    appliesToIndustries: [],
    scaleTiers: ["smb"],
    priceBasis: "SOLUTION_MAP service, no published price. ESTIMATE ONLY",
    features: [
      { code: "PROFILE_SETUP", label: "Profile claim and completion", priceImpact: 0, isDefault: true },
      { code: "REVIEW_FLOW", label: "Review request flow", priceImpact: 2500, isDefault: false },
      { code: "POSTS_MONTHLY", label: "Monthly posts and photo updates", priceImpact: 0, isDefault: false },
    ],
  },
  {
    code: "SEO_FIXES",
    title: "Technical SEO audit and fixes",
    description:
      "Fix what stops search engines ranking the site - speed, mobile layout, titles, indexing.",
    category: "analytics",
    basePrice: 4000,
    complexityMultiplier: 1.15,
    marginPercentage: 38,
    monthlyPrice: 2000,
    deliveryWeeksMin: 1,
    deliveryWeeksMax: 3,
    answersGapTags: ["seo"],
    appliesToIndustries: [],
    scaleTiers: ["smb", "midmarket"],
    priceBasis: "SOLUTION_MAP service; free audit is already promised in the report. ESTIMATE ONLY",
    features: [
      { code: "AUDIT", label: "Full technical audit", priceImpact: 0, isDefault: true },
      { code: "FIX_IMPLEMENT", label: "Implement the fixes", priceImpact: 4000, isDefault: true },
      { code: "ONGOING_MONITOR", label: "Monthly monitoring", priceImpact: 0, isDefault: false },
    ],
  },
  {
    code: "SOCIAL_PRESENCE",
    title: "Social media setup and management",
    description: "Business pages set up properly, with a posting rhythm that builds credibility.",
    category: "intake",
    basePrice: 5000,
    complexityMultiplier: 1,
    marginPercentage: 38,
    monthlyPrice: 4000,
    deliveryWeeksMin: 1,
    deliveryWeeksMax: 2,
    answersGapTags: ["social"],
    appliesToIndustries: [],
    scaleTiers: ["smb"],
    priceBasis: "SOLUTION_MAP service, no published price. ESTIMATE ONLY",
    features: [
      { code: "PAGE_SETUP", label: "Page setup and branding", priceImpact: 0, isDefault: true },
      { code: "CONTENT_PLAN", label: "Monthly content plan", priceImpact: 0, isDefault: false },
      { code: "AD_SETUP", label: "Paid ad setup", priceImpact: 6000, isDefault: false },
    ],
  },
  {
    code: "WHATSAPP_CRM",
    title: "WhatsApp CRM and shared inbox",
    description:
      "One inbox for the whole team, with every enquiry recorded against a contact.",
    category: "crm",
    basePrice: 9000,
    complexityMultiplier: 1.2,
    marginPercentage: 34,
    monthlyPrice: 3500,
    deliveryWeeksMin: 2,
    deliveryWeeksMax: 4,
    answersGapTags: [],
    appliesToIndustries: [],
    scaleTiers: ["smb", "midmarket"],
    priceBasis: "Growth tier delta over Starter (Rs 15,000-30,000 total). Delivered on the Dashboard-WhatsApp platform",
    features: [
      { code: "SHARED_INBOX", label: "Shared team inbox", priceImpact: 0, isDefault: true },
      { code: "AUTO_REPLY", label: "Instant acknowledgement", priceImpact: 0, isDefault: true },
      { code: "TEMPLATES", label: "Approved message templates", priceImpact: 3000, isDefault: false },
      { code: "CHATBOT_AI", label: "AI first-response", priceImpact: 8000, isDefault: false },
    ],
  },
  {
    code: "LEAD_MANAGEMENT",
    title: "Lead management system",
    description:
      "Every enquiry captured, assigned and followed up, so nothing is lost to a missed call.",
    category: "crm",
    basePrice: 12000,
    complexityMultiplier: 1.2,
    marginPercentage: 32,
    monthlyPrice: 3000,
    deliveryWeeksMin: 3,
    deliveryWeeksMax: 6,
    answersGapTags: [],
    appliesToIndustries: [],
    scaleTiers: ["smb", "midmarket"],
    priceBasis: "Growth-to-Complete range. UNVERIFIED",
    features: [
      { code: "PIPELINE", label: "Pipeline stages and ownership", priceImpact: 0, isDefault: true },
      { code: "FOLLOWUP_AUTO", label: "Automated follow-up sequence", priceImpact: 5000, isDefault: true },
      { code: "QUOTATION", label: "Quotation generation", priceImpact: 6000, isDefault: false },
      { code: "REPORTS", label: "Conversion reporting", priceImpact: 4000, isDefault: false },
    ],
  },
  {
    code: "INVENTORY",
    title: "Inventory management",
    description: "Know what stock exists, what is moving, and what is about to run out.",
    category: "operations",
    basePrice: 18000,
    complexityMultiplier: 1.3,
    marginPercentage: 30,
    monthlyPrice: 3500,
    deliveryWeeksMin: 4,
    deliveryWeeksMax: 8,
    answersGapTags: [],
    appliesToIndustries: [
      "textile_apparel", "leather_footwear", "food_processing", "trade_services",
      "paper_packaging", "chemicals", "metals_heavy_industry", "electronics_electricals",
      "automobile_auto_components", "pharmaceuticals_healthcare",
    ],
    scaleTiers: ["smb", "midmarket"],
    priceBasis: "Complete tier one-time (Rs 30,000-60,000) shared with other modules. UNVERIFIED",
    features: [
      { code: "STOCK_TRACK", label: "Stock levels and movements", priceImpact: 0, isDefault: true },
      { code: "LOW_STOCK_ALERT", label: "Low-stock alerts", priceImpact: 2500, isDefault: true },
      { code: "BARCODE", label: "Barcode scanning", priceImpact: 7000, isDefault: false },
      { code: "MULTI_LOCATION", label: "Multiple godowns or outlets", priceImpact: 9000, isDefault: false },
    ],
  },
  {
    code: "BILLING_GST",
    title: "Billing and GST invoicing",
    description: "Compliant invoices, payment tracking and a clear view of what is owed.",
    category: "operations",
    basePrice: 15000,
    complexityMultiplier: 1.25,
    marginPercentage: 32,
    monthlyPrice: 2500,
    deliveryWeeksMin: 3,
    deliveryWeeksMax: 6,
    answersGapTags: [],
    appliesToIndustries: [],
    scaleTiers: ["smb", "midmarket"],
    priceBasis: "Vega's own GST_INVOICE_AUTOMATION exists at Rs 1,20,000+ for enterprise. SMB figure UNVERIFIED",
    features: [
      { code: "GST_COMPLIANT", label: "GST-compliant invoice format", priceImpact: 0, isDefault: true },
      { code: "PAYMENT_TRACK", label: "Payment and dues tracking", priceImpact: 4000, isDefault: true },
      { code: "EINVOICE", label: "E-invoicing (IRN)", description: "Needed above the turnover threshold.", priceImpact: 12000, isDefault: false },
      { code: "TALLY_SYNC", label: "Tally export", priceImpact: 8000, isDefault: false },
    ],
  },
  {
    code: "MOBILE_APP",
    title: "Mobile app",
    description: "An Android or iOS app where the customer or the field team needs one.",
    category: "mobile",
    basePrice: 45000,
    complexityMultiplier: 1.4,
    marginPercentage: 30,
    monthlyPrice: 5000,
    deliveryWeeksMin: 8,
    deliveryWeeksMax: 16,
    answersGapTags: [],
    appliesToIndustries: [],
    scaleTiers: ["midmarket", "enterprise"],
    priceBasis: "NO ANCHOR AT ALL - not in published pricing or Vega's catalog. PURE PLACEHOLDER",
    features: [
      { code: "ANDROID", label: "Android", priceImpact: 0, isDefault: true },
      { code: "IOS", label: "iOS", priceImpact: 25000, isDefault: false },
      { code: "PUSH", label: "Push notifications", priceImpact: 6000, isDefault: true },
      { code: "OFFLINE", label: "Works offline", priceImpact: 15000, isDefault: false },
    ],
  },
  {
    code: "AUTOMATION_FLOWS",
    title: "Workflow automation",
    description:
      "The repetitive follow-ups, reminders and hand-offs done automatically instead of by memory.",
    category: "automation",
    basePrice: 10000,
    complexityMultiplier: 1.25,
    marginPercentage: 34,
    monthlyPrice: 3000,
    deliveryWeeksMin: 2,
    deliveryWeeksMax: 5,
    answersGapTags: [],
    appliesToIndustries: [],
    scaleTiers: ["smb", "midmarket"],
    priceBasis: "Complete tier's 'full automation flows'. UNVERIFIED",
    features: [
      { code: "FOLLOWUP_SEQ", label: "Follow-up sequences", priceImpact: 0, isDefault: true },
      { code: "REMINDERS", label: "Payment and renewal reminders", priceImpact: 3000, isDefault: true },
      { code: "AI_ASSIST", label: "AI drafting and summarising", priceImpact: 9000, isDefault: false },
    ],
  },
  {
    code: "CLIENT_PORTAL_SMB",
    title: "Customer portal",
    description: "A login where the customer sees their orders, status and documents.",
    category: "operations",
    basePrice: 16000,
    complexityMultiplier: 1.25,
    marginPercentage: 32,
    monthlyPrice: 2500,
    deliveryWeeksMin: 3,
    deliveryWeeksMax: 7,
    answersGapTags: [],
    appliesToIndustries: [],
    scaleTiers: ["midmarket", "enterprise"],
    priceBasis: "Vega's CLIENT_DASHBOARD exists at enterprise pricing. SMB figure UNVERIFIED",
    features: [
      { code: "ORDER_STATUS", label: "Order and job status", priceImpact: 0, isDefault: true },
      { code: "DOC_VAULT", label: "Document downloads", priceImpact: 4000, isDefault: true },
      { code: "PAY_ONLINE", label: "Pay outstanding invoices", priceImpact: 7000, isDefault: false },
    ],
  },
];
