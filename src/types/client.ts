import type { BaseDocument, ObjectId } from "@/types/common";

export interface ClientAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface Client extends BaseDocument {
  legalName: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone?: string;
  address?: ClientAddress;
  companySize?: string;
  industry?: string;
  preferredCommunication?: "email" | "phone" | "whatsapp" | "slack" | "meetings";
  requirementSummary?: string;
  requirementDetails?: string;
  onboardingStatus?: "pending" | "in_progress" | "completed";
  onboardedByUserId?: ObjectId | null;
  onboardedAt?: string | null;
  leadId?: ObjectId | null;
  accountManagerId?: ObjectId | null;
}
