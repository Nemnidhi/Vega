import { model, models, Schema, type InferSchemaType } from "mongoose";

export const leadFollowUpStatusValues = ["scheduled", "completed", "missed", "cancelled"] as const;
export const leadFollowUpChannelValues = ["call", "whatsapp", "email", "meeting", "other"] as const;
export const leadFollowUpPriorityValues = ["low", "medium", "high", "urgent"] as const;
export const leadFollowUpOutcomeValues = [
  "no_answer",
  "not_picking_call",
  "call_back_later",
  "interested",
  "not_interested",
  "wrong_number",
  "qualified",
  "proposal_requested",
  "other",
] as const;

const leadFollowUpSchema = new Schema(
  {
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    status: {
      type: String,
      enum: leadFollowUpStatusValues,
      default: "scheduled",
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: leadFollowUpChannelValues,
      default: "call",
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: leadFollowUpPriorityValues,
      default: "medium",
      required: true,
      index: true,
    },
    dueAt: { type: Date, required: true, index: true },
    nextAction: { type: String, trim: true, minlength: 2, maxlength: 200, required: true },
    notes: { type: String, trim: true, maxlength: 2000, default: "" },
    outcome: { type: String, enum: leadFollowUpOutcomeValues, default: null, index: true },
    outcomeNote: { type: String, trim: true, maxlength: 2000, default: "" },
    completedAt: { type: Date, default: null, index: true },
    assignedToUserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    createdById: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true },
);

leadFollowUpSchema.index({ leadId: 1, dueAt: 1 });
leadFollowUpSchema.index({ status: 1, dueAt: 1, priority: 1 });
leadFollowUpSchema.index({ assignedToUserId: 1, status: 1, dueAt: 1 });

export type LeadFollowUpDocument = InferSchemaType<typeof leadFollowUpSchema>;

const existingLeadFollowUpModel = models.LeadFollowUp;
const existingStatusEnum = existingLeadFollowUpModel?.schema.path("status")?.options?.enum;

if (
  existingLeadFollowUpModel &&
  Array.isArray(existingStatusEnum) &&
  !existingStatusEnum.includes("missed")
) {
  delete models.LeadFollowUp;
}

export const LeadFollowUpModel =
  models.LeadFollowUp || model("LeadFollowUp", leadFollowUpSchema);
