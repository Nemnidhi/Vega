// Editable content for the digital-presence report: company details,
// pricing tiers, and canned copy. Change values here - this file is the
// single source shared by the report template and anything else that needs
// company details.
//
// Ported from Samvid's src/lib/reportConfig.js. The CommonJS/ESM split that
// existed there is gone: Vega runs everything through one TypeScript module
// graph, so there is no mirror file to keep in sync.

export interface PricingTier {
  name: string;
  oneTime: string;
  monthly: string;
  includes: string;
}

export const COMPANY = {
  product: "Samvid Lead Engine",
  legalName: "Nemnidhi",
  tagline: "Engineering Software That Scales",
  gst: "23CGZPB7175E1Z5",
  address: "B20 - 5th Floor, Gravity Mall, Mechanic Nagar, Indore, Madhya Pradesh, India",
  // The real Nemnidhi business WhatsApp/contact number - was a personal number before, now
  // corrected since this goes out on every audit report to the public.
  phone: "8269150205",
  email: "info@nemnidhi.com",
} as const;

export const WHO_WE_ARE = `This audit was run by ${COMPANY.legalName}, a software studio in Indore that builds and manages digital systems - websites, CRM, and automation - for growing businesses, not one-off jobs. A person reviewed this report before it reached you; nothing here is auto-generated spam.`;

export const PRIVACY_NOTE =
  "Everything in this report - website status, business listings, and public social media presence - was gathered from publicly available sources only. No private data, messages, or account information was accessed.";

// Maps a Digital Presence Audit row label to the fix we'd sell for that gap.
// Only rows the lead is actually missing get shown in the Problem -> Solution table.
export const SOLUTION_MAP: Record<string, string> = {
  Website: "Website build",
  "Google Business profile": "Google Business setup & optimization",
  "Meta Page": "Social media page setup & management",
  "Meta ad activity": "Social media presence & ad setup",
  "Technical SEO": "Technical SEO audit & fixes",
};

// What each fix actually improves - shown alongside the fix in "What Fixes
// What" so it reads as an outcome, not just a checklist item.
export const IMPACT_MAP: Record<string, string> = {
  "Website build": "Customers can find and vet you before they ever pick up the phone",
  "Google Business setup & optimization": "Shows up in local search and Google Maps when someone's looking nearby",
  "Social media page setup & management": "Builds trust and credibility before the first direct contact",
  "Social media presence & ad setup": "Puts you in front of buyers who are actively looking, not waiting to be found",
  "Technical SEO audit & fixes": "Improves how easily search engines surface your site over competitors",
};

export const PACKAGES_NOTE = "Every package includes a free technical SEO audit of your website.";

export const DEFAULT_PAIN_POINTS =
  "Today, leads typically come in by phone call or a walk-in visit. There's often no record kept beyond a notebook or memory, no scheduled follow-up, and if the first call goes unanswered, the lead simply moves on to the next business that does pick up. Nothing tracks who was contacted, when, or what happened next.";

/** Each step is [title, subtitle] rendered as one box in the flow diagram. */
export type FlowStep = [string, string | null];

// Content for the automation flow diagram.
export const AUTOMATION_FLOW: {
  entryChain: FlowStep[];
  interested: { label: string; steps: FlowStep[] };
  noReply: { label: string; steps: FlowStep[] };
} = {
  entryChain: [
    ["Lead enters", "WhatsApp, website form, walk-in, or call"],
    ["Auto-captured & tagged", "Contact + Lead record created automatically"],
    ["Instant acknowledgment", "Automated reply within minutes"],
  ],
  interested: {
    label: "If interested",
    steps: [
      ["Routed to a person", null],
      ["Booked call / conversion", null],
    ],
  },
  noReply: {
    label: "If no reply",
    steps: [
      ["Follow-up sequence", "Day 1, 3, 7"],
      ["Still no reply", "Marked cold, saved for later re-engagement"],
    ],
  },
};

// Edit these three rows to change the packaged pricing shown in every report.
export const PRICING_TIERS: PricingTier[] = [
  {
    name: "Starter",
    oneTime: "Rs. 8,000 - Rs. 15,000",
    monthly: "Rs. 1,500 - Rs. 3,000/mo",
    includes: "Website or landing page only, self-hosted",
  },
  {
    name: "Growth",
    oneTime: "Rs. 15,000 - Rs. 30,000",
    monthly: "Rs. 5,000 - Rs. 8,000/mo",
    includes: "+ WhatsApp CRM/inbox + basic follow-up automation",
  },
  {
    name: "Complete",
    oneTime: "Rs. 30,000 - Rs. 60,000",
    monthly: "Rs. 10,000 - Rs. 15,000/mo",
    includes: "+ full automation flows + ops system + priority support",
  },
];

// Edit to change the custom/enterprise tier shown below the packaged table.
export const CUSTOM_TIER = {
  name: "Custom / Enterprise",
  oneTime: "Scoped after a discovery call",
  ongoing: "15-20% of the development fee, billed yearly",
  includes:
    "For businesses with complex catalogs, unique workflows, or multi-location operations that don't fit a template.",
} as const;

export const CLOSING_CTA = `Every gap above is fixable within weeks, not months. Reply on WhatsApp, email ${COMPANY.email}, or call ${COMPANY.phone} and we'll show you exactly how - no obligation.`;

export const RESPONSE_TIME_NOTE = "We reply within 24 hours.";

// wa.me expects the full international number, no leading zero or symbols.
// COMPANY.phone is a 10-digit Indian mobile number, so prefix the country code.
export const WHATSAPP_LINK = `https://wa.me/91${COMPANY.phone}`;

// The five-pillar platform pitch shown on the appendix page (report-template.tsx) and mirrored on
// the public web view (report-data.ts) - one copy so the two surfaces can't say different things.
export const PLATFORM_PILLARS: { title: string; body: string }[] = [
  {
    title: "CRM & Client Management",
    body: "One place to track every lead, proposal, client and project from first contact to delivery.",
  },
  {
    title: "WhatsApp Business Automation",
    body: "A shared team inbox with automated replies, broadcast campaigns and catalog & order sharing - the channel your customers already use.",
  },
  {
    title: "AI Assistance",
    body: "AI-drafted replies, lead scoring, and automation flows that handle repetitive conversations.",
  },
  {
    title: "Websites & Digital Presence",
    body: "A fast, SEO-ready website with lead capture and click-to-WhatsApp ad integration.",
  },
  {
    title: "Billing, Invoicing & Compliance",
    body: "GST-ready invoicing, subscription billing and financial reporting, sold standalone or as part of the full platform.",
  },
];

export const NEXT_STEPS: string[] = [
  "Reply on WhatsApp or email - takes 30 seconds",
  "A 15-minute call to understand your business and priorities",
  "We send a firm, itemized quote - no obligation to proceed",
];
