import { model, models, Schema, type InferSchemaType } from "mongoose";

const leadNoteSchema = new Schema(
  {
    leadId: {
      type: Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },
    note: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 2000,
    },
    createdById: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

leadNoteSchema.index({ leadId: 1, createdAt: -1 });

export type LeadNoteDocument = InferSchemaType<typeof leadNoteSchema>;

export const LeadNoteModel = models.LeadNote || model("LeadNote", leadNoteSchema);
