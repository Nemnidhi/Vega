import type { BaseDocument, ObjectId } from "@/types/common";
import type { ProspectingTier } from "@/types/lead";

export interface Report extends BaseDocument {
  leadId: ObjectId;
  legacyLeadId?: number;
  pdf: Buffer;
  categoryUsed: ProspectingTier;
  paragraphSource?: string;
  generatedAt: Date;
  sentAt?: Date | null;
  sentTo?: string | null;
}
