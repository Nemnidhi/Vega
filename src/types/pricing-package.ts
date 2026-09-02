import type { BaseDocument } from "@/types/common";

export interface PricingTier extends BaseDocument {
  key: string;
  label: string;
  order: number;
  isActive: boolean;
}

export type PackageComponentStatus = "included" | "addon" | "unavailable";

export interface PackageComponent {
  componentId: string;
  status: PackageComponentStatus;
}

export interface PillarPricing {
  marketing_sales: number;
  operations: number;
  documentation_admin: number;
  service_support: number;
}

export interface PricingPackage extends BaseDocument {
  industryId: string;
  segmentId: string | null;
  tierId: string;
  bestForDescription: string;
  setupPrice: number;
  monthlyPrice: number;
  pillarPricing: PillarPricing;
  componentInclusions: PackageComponent[];
  isActive: boolean;
}
