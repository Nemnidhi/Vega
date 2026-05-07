import { model, models, Schema, type InferSchemaType } from "mongoose";

const clientAddressSchema = new Schema(
  {
    line1: { type: String, trim: true, maxlength: 200, required: true },
    line2: { type: String, trim: true, maxlength: 200 },
    city: { type: String, trim: true, maxlength: 100, required: true },
    state: { type: String, trim: true, maxlength: 100, required: true },
    postalCode: { type: String, trim: true, maxlength: 20, required: true },
    country: { type: String, trim: true, maxlength: 100, required: true },
  },
  { _id: false },
);

const clientSchema = new Schema(
  {
    legalName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 200,
      index: true,
    },
    primaryContactName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    primaryContactEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 180,
      index: true,
    },
    primaryContactPhone: { type: String, trim: true, maxlength: 30 },
    address: { type: clientAddressSchema, default: null },
    companySize: { type: String, trim: true, maxlength: 80 },
    industry: { type: String, trim: true, maxlength: 120 },
    preferredCommunication: {
      type: String,
      enum: ["email", "phone", "whatsapp", "slack", "meetings"],
      default: "email",
    },
    requirementSummary: { type: String, trim: true, maxlength: 500 },
    requirementDetails: { type: String, trim: true, maxlength: 3000 },
    onboardingStatus: {
      type: String,
      enum: ["pending", "in_progress", "completed"],
      default: "pending",
      index: true,
    },
    onboardedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    onboardedAt: { type: Date, default: null },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", default: null, index: true },
    accountManagerId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
  },
  { timestamps: true },
);

export type ClientDocument = InferSchemaType<typeof clientSchema>;

export const ClientModel = models.Client || model("Client", clientSchema);
