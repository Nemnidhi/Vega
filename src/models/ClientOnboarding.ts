import { model, models, Schema, type InferSchemaType } from "mongoose";

const onboardingChecklistSchema = new Schema(
  {
    accountSetup: { type: Boolean, default: false },
    businessProfile: { type: Boolean, default: false },
    requirementsShared: { type: Boolean, default: false },
    documentsShared: { type: Boolean, default: false },
    kickoffCallBooked: { type: Boolean, default: false },
  },
  { _id: false },
);

const clientOnboardingSchema = new Schema(
  {
    clientUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    companyName: { type: String, trim: true, maxlength: 200, default: "" },
    primaryGoal: { type: String, trim: true, maxlength: 240, default: "" },
    kickoffDate: { type: Date, default: null },
    preferredCommunication: {
      type: String,
      enum: ["email", "phone", "whatsapp", "slack", "meetings"],
      default: "email",
    },
    billingContactEmail: { type: String, trim: true, lowercase: true, maxlength: 180, default: "" },
    projectBrief: { type: String, trim: true, maxlength: 2000, default: "" },
    onboardingNotes: { type: String, trim: true, maxlength: 1200, default: "" },
    checklist: {
      type: onboardingChecklistSchema,
      default: () => ({
        accountSetup: false,
        businessProfile: false,
        requirementsShared: false,
        documentsShared: false,
        kickoffCallBooked: false,
      }),
    },
  },
  { timestamps: true },
);

export type ClientOnboardingDocument = InferSchemaType<typeof clientOnboardingSchema>;

export const ClientOnboardingModel =
  models.ClientOnboarding || model("ClientOnboarding", clientOnboardingSchema);
