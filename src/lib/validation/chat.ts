import { z } from "zod";
import { objectIdSchema } from "@/lib/validation/common";

export const sendChatMessageSchema = z.object({
  recipientId: objectIdSchema,
  message: z.string().trim().min(1).max(2000),
});

export const getChatThreadSchema = z.object({
  with: objectIdSchema,
  limit: z.coerce.number().int().min(1).max(200).default(100),
  markRead: z
    .enum(["0", "1"])
    .optional()
    .transform((value) => value !== "0"),
});
