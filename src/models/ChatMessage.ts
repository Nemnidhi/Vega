import { model, models, Schema, type InferSchemaType } from "mongoose";

const chatMessageSchema = new Schema(
  {
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 2000,
    },
    readAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
  },
);

chatMessageSchema.index({ senderId: 1, recipientId: 1, createdAt: -1 });
chatMessageSchema.index({ recipientId: 1, readAt: 1, createdAt: -1 });

export type ChatMessageDocument = InferSchemaType<typeof chatMessageSchema>;

export const ChatMessageModel = models.ChatMessage || model("ChatMessage", chatMessageSchema);
