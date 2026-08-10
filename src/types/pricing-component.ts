import type { BaseDocument } from "@/types/common";

export type PricingCategory =
  | "website"
  | "mobile"
  | "intake"
  | "crm"
  | "automation"
  | "integration"
  | "analytics"
  | "ai"
  | "operations";

/**
 * A selectable option within a component - "Website" is one thing to sell,
 * but "with online payments" is a decision made on the call.
 *
 * `priceImpact` is added to the component's base price before margin, so a
 * feature can never be sold below the protected margin either.
 */
export interface ComponentFeature {
  code: string;
  label: string;
  description?: string;
  priceImpact: number;
  /** Included unless deselected - the sensible default build. */
  isDefault: boolean;
  /** Codes of features this one needs; surfaced so a quote can't be incoherent. */
  requires?: string[];
}

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
  features: ComponentFeature[];
  /** Knowledge-bank industry keys this suits. Empty means every industry. */
  appliesToIndustries: string[];
  /** Gap tags from the audit that this component answers ("website", "social"). */
  answersGapTags: string[];
  /** Rough build time, for the blueprint's indicative timeline. */
  deliveryWeeksMin: number;
  deliveryWeeksMax: number;
  /** Recurring management fee, where the component has one. */
  monthlyPrice: number;
  /** Which size of business this price is for. */
  scaleTiers: Array<"smb" | "midmarket" | "enterprise">;
  /** Where the price came from - kept visible so guesses stay correctable. */
  priceBasis: string;
}
