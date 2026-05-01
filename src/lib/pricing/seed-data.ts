import type { PricingCategory } from "@/types/pricing-component";

type SeedPricingComponent = {
  code: string;
  title: string;
  description: string;
  category: PricingCategory;
  basePrice: number;
  complexityMultiplier: number;
  marginPercentage: number;
};

export const seedPricingComponents: SeedPricingComponent[] = [
  {
    code: "INTAKE_BASIC",
    title: "Basic intake system",
    description: "Lead intake forms, validation, and central capture dashboard.",
    category: "intake",
    basePrice: 120000,
    complexityMultiplier: 1.1,
    marginPercentage: 32,
  },
  {
    code: "CRM_PIPELINE",
    title: "CRM pipeline",
    description: "Lead stages, owner mapping, and visual pipeline management.",
    category: "crm",
    basePrice: 180000,
    complexityMultiplier: 1.2,
    marginPercentage: 30,
  },
  {
    code: "WHATSAPP_UPDATES",
    title: "WhatsApp updates",
    description: "Automated update workflows and delivery notifications.",
    category: "automation",
    basePrice: 75000,
    complexityMultiplier: 1.15,
    marginPercentage: 34,
  },
  {
    code: "ECOURTS_SYNC",
    title: "e-Courts sync",
    description: "Case-data synchronization bridge with reconciliation controls.",
    category: "integration",
    basePrice: 220000,
    complexityMultiplier: 1.25,
    marginPercentage: 36,
  },
  {
    code: "CLIENT_DASHBOARD",
    title: "Client dashboard",
    description: "Client-facing progress, documents, and milestone visibility.",
    category: "operations",
    basePrice: 140000,
    complexityMultiplier: 1.15,
    marginPercentage: 30,
  },
  {
    code: "GST_INVOICE_AUTOMATION",
    title: "GST invoice automation",
    description: "Tax-ready invoice generation and billing workflow support.",
    category: "automation",
    basePrice: 95000,
    complexityMultiplier: 1.1,
    marginPercentage: 28,
  },
  {
    code: "HRMS_MODULE",
    title: "HRMS module",
    description: "Employee operations module with role-aware workflow controls.",
    category: "operations",
    basePrice: 160000,
    complexityMultiplier: 1.2,
    marginPercentage: 33,
  },
  {
    code: "AI_DRAFTING_COPILOT",
    title: "AI drafting copilot",
    description: "Assisted drafting with firm-specific knowledge constraints.",
    category: "ai",
    basePrice: 250000,
    complexityMultiplier: 1.3,
    marginPercentage: 40,
  },
  {
    code: "JUDGMENT_SUMMARIZER",
    title: "Judgment summarizer",
    description: "Summarization pipeline for judgments and case references.",
    category: "ai",
    basePrice: 210000,
    complexityMultiplier: 1.22,
    marginPercentage: 38,
  },
  {
    code: "CUSTOM_INTEGRATION",
    title: "Custom integration",
    description: "Bespoke connector for third-party or legacy ecosystem systems.",
    category: "integration",
    basePrice: 280000,
    complexityMultiplier: 1.35,
    marginPercentage: 42,
  },
];
