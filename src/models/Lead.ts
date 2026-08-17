import { model, models, Schema, type InferSchemaType } from "mongoose";

const leadBudgetSchema = new Schema(
  {
    min: { type: Number, min: 0, required: true },
    max: { type: Number, min: 0, required: true },
    currency: { type: String, enum: ["INR", "USD"], default: "INR", required: true },
  },
  { _id: false },
);

const websiteSignalSchema = new Schema(
  {
    found: { type: Boolean, default: false },
    url: { type: String, trim: true, maxlength: 500, default: null },
    checkedAt: { type: Date, default: null },
  },
  { _id: false },
);

const googleBusinessSignalSchema = new Schema(
  {
    // `checked` and `found` are separate on purpose: a failed API call is
    // "not checked", never a false "not found".
    checked: { type: Boolean, default: false },
    found: { type: Boolean, default: null },
    rating: { type: Number, default: null },
    reviewCount: { type: Number, default: null },
    placeName: { type: String, trim: true, maxlength: 200, default: null },
    // Places returns the nearest match rather than nothing, so a listing is
    // only credited when its name actually matches. Score is stored so the
    // threshold can be retuned without re-calling the API.
    nameMatch: { type: String, enum: ["strong", "weak", "unverifiable"], default: null },
    nameSimilarity: { type: Number, default: null },
    reason: { type: String, trim: true, maxlength: 300, default: null },
    checkedAt: { type: Date, default: null },
  },
  { _id: false },
);

const metaAdsSignalSchema = new Schema(
  {
    checked: { type: Boolean, default: false },
    found: { type: Boolean, default: null },
    activeCount: { type: Number, default: null },
    checkedAt: { type: Date, default: null },
  },
  { _id: false },
);

// Presence + follower counts, distinct from metaAds (running ads).
// Deliberately excluded from tier classification - see classify.ts and
// technicalSeoSignalSchema below for the same precedent.
const metaPresenceSignalSchema = new Schema(
  {
    checked: { type: Boolean, default: false },
    facebookFound: { type: Boolean, default: null },
    facebookFollowers: { type: Number, default: null },
    facebookPlaceName: { type: String, trim: true, maxlength: 200, default: null },
    instagramFound: { type: Boolean, default: null },
    instagramFollowers: { type: Number, default: null },
    instagramUsername: { type: String, trim: true, maxlength: 100, default: null },
    instagramMatchSource: { type: String, enum: ["linked", "guessed", null], default: null },
    reason: { type: String, trim: true, maxlength: 300, default: null },
    checkedAt: { type: Date, default: null },
  },
  { _id: false },
);

// Quality of an existing site, not presence. Kept out of the classifier on
// purpose - see check-technical-seo.ts.
const technicalSeoSignalSchema = new Schema(
  {
    checked: { type: Boolean, default: false },
    seoScore: { type: Number, default: null },
    performanceScore: { type: Number, default: null },
    isMobileFriendly: { type: Boolean, default: null },
    isIndexable: { type: Boolean, default: null },
    largestContentfulPaintMs: { type: Number, default: null },
    issues: [{ type: String, trim: true, maxlength: 200 }],
    auditedUrl: { type: String, trim: true, maxlength: 500, default: null },
    reason: { type: String, trim: true, maxlength: 300, default: null },
    checkedAt: { type: Date, default: null },
  },
  { _id: false },
);

const prospectingClassificationSchema = new Schema(
  {
    category: { type: String, enum: ["A", "B", "C", "D"], default: null },
    confidence: { type: String, enum: ["partial", "full"], default: null },
    signalsChecked: { type: Number, default: 0 },
    signalsFound: { type: Number, default: 0 },
    reasoning: { type: String, trim: true, maxlength: 1000 },
    classifiedAt: { type: Date, default: null },
  },
  { _id: false },
);

// Audit-processing state, ported from the Samvid Lead Engine. Fully optional:
// inbound leads never populate it. Kept as a sub-document rather than flat
// fields so it can be projected out of Lead reads that don't need it.
const prospectingSchema = new Schema(
  {
    legacyLeadId: { type: Number, default: null, index: true },
    industry: { type: String, trim: true, maxlength: 60, index: true },
    segment: { type: String, trim: true, maxlength: 60 },
    // How `industry` was decided, so a wrong one can be traced and requeried.
    // "explicit" = the source named the sector; "low" = guessed from a
    // company name and worth a human glance.
    industryConfidence: {
      type: String,
      enum: ["explicit", "high", "low", "unknown"],
      default: null,
      index: true,
    },
    industryMatchedOn: { type: String, trim: true, maxlength: 200, default: null },
    /** A sector the source named that the knowledge bank doesn't cover yet. */
    unmappedIndustryLabel: { type: String, trim: true, maxlength: 120, default: null },
    businessCategory: { type: String, trim: true, maxlength: 300 },
    state: { type: String, trim: true, maxlength: 100, index: true },
    district: { type: String, trim: true, maxlength: 100 },
    entityType: { type: String, trim: true, maxlength: 100 },
    registrationNo: { type: String, trim: true, maxlength: 100 },
    priorityScore: { type: Number, default: null },
    priorityTier: { type: String, trim: true, maxlength: 40 },
    prospectingStatus: {
      type: String,
      enum: ["new", "enriched", "classified", "reported", "sent"],
      default: "new",
      index: true,
    },
    digitalPresence: {
      website: { type: websiteSignalSchema, default: null },
      googleBusiness: { type: googleBusinessSignalSchema, default: null },
      metaAds: { type: metaAdsSignalSchema, default: null },
      metaPresence: { type: metaPresenceSignalSchema, default: null },
      technicalSeo: { type: technicalSeoSignalSchema, default: null },
    },
    classification: { type: prospectingClassificationSchema, default: null },
  },
  { _id: false },
);

// Cold prospects come from public registries: a business name, sometimes a
// phone, and nothing else. Inbound leads still have to carry full details -
// enforced here and mirrored in `createLeadSchema`.
function requiredForInboundLeads(this: { source?: string }) {
  return this.source !== "cold_outreach";
}

const leadSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 200,
    },
    contactName: {
      type: String,
      required: requiredForInboundLeads,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    email: {
      type: String,
      required: requiredForInboundLeads,
      trim: true,
      lowercase: true,
      maxlength: 180,
      index: true,
    },
    phone: { type: String, trim: true, maxlength: 30 },
    source: {
      type: String,
      enum: ["website", "referral", "cold_outreach", "paid_ads", "event", "partner", "other"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        "new",
        "contacted",
        "qualified",
        "proposal_sent",
        "negotiation",
        "closed_won",
        "closed_lost",
        "invalid",
      ],
      default: "new",
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ["software_request", "infrastructure", "legal_automation", "retainer_enterprise", "other"],
      required: requiredForInboundLeads,
      index: true,
    },
    urgency: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      required: requiredForInboundLeads,
      index: true,
    },
    budget: { type: leadBudgetSchema, default: null },
    description: {
      type: String,
      required: requiredForInboundLeads,
      trim: true,
      minlength: 10,
      maxlength: 5000,
    },
    sourceDomain: { type: String, trim: true, lowercase: true, maxlength: 180, index: true },
    sourcePath: { type: String, trim: true, maxlength: 500 },
    sourceReferrer: { type: String, trim: true, maxlength: 1000 },
    /** Meta Lead Ads dedupe key (their leadgen_id) - unique/sparse since only ads-sourced leads set it. */
    metaLeadId: { type: String, trim: true, maxlength: 60, unique: true, sparse: true, index: true },
    metaPageId: { type: String, trim: true, maxlength: 60 },
    metaFormId: { type: String, trim: true, maxlength: 60 },
    score: { type: Number, min: 0, max: 100, default: 0, index: true },
    priorityBand: {
      type: String,
      enum: ["heavy_artillery", "standard_sales", "volume_pipeline"],
      default: "volume_pipeline",
      index: true,
    },
    priorityFlag: { type: Boolean, default: false, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", default: null, index: true },
    tags: [{ type: String, trim: true, maxlength: 40 }],
    prospecting: { type: prospectingSchema, default: null },
  },
  {
    timestamps: true,
  },
);

leadSchema.index({ status: 1, updatedAt: -1 });
leadSchema.index({ updatedAt: -1 });
leadSchema.index({ priorityBand: 1, score: -1 });
leadSchema.index({ sourceDomain: 1, createdAt: -1 });
// Tier filter on the leads list, and the enrichment/classification cron's
// "next batch to process" query.
leadSchema.index({ "prospecting.classification.category": 1, updatedAt: -1 });
leadSchema.index({ "prospecting.prospectingStatus": 1, "prospecting.priorityScore": -1 });

export type LeadDocument = InferSchemaType<typeof leadSchema>;

const existingLeadModel = models.Lead;
const existingLeadStatusEnum = existingLeadModel?.schema.path("status")?.options?.enum;

// In dev HMR, an older cached model can keep the previous status enum, or
// predate the `prospecting` sub-document entirely.
if (
  existingLeadModel &&
  ((Array.isArray(existingLeadStatusEnum) && !existingLeadStatusEnum.includes("invalid")) ||
    !existingLeadModel.schema.path("prospecting"))
) {
  delete models.Lead;
}

export const LeadModel = models.Lead || model("Lead", leadSchema);
