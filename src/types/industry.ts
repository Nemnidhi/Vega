import type { BaseDocument } from "@/types/common";

export interface Industry extends BaseDocument {
  key: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

export interface IndustrySegment extends BaseDocument {
  industryId: string;
  key: string;
  label: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
}
