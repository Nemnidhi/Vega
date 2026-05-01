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
  leadId?: ObjectId | null;
  accountManagerId?: ObjectId | null;
}
