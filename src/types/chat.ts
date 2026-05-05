import type { BaseDocument, ObjectId } from "@/types/common";

export interface ChatMessage extends BaseDocument {
  senderId: ObjectId;
  recipientId: ObjectId;
  message: string;
  readAt?: Date | null;
}
