import type { BaseDocument } from "@/types/common";

export type PricingCategory =
  | "intake"
  | "crm"
  | "automation"
  | "integration"
  | "analytics"
  | "ai"
  | "operations";

export interface PricingComponent extends BaseDocument {
  code: string;
  title: string;
  description: string;
  category: PricingCategory;
  basePrice: number;
  complexityMultiplier: number;
  marginPercentage: number;
  finalPrice: number;
  isActive: boolean;
}
