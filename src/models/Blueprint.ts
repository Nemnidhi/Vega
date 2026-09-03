import { model, models, Schema, type InferSchemaType } from "mongoose";

/**
 * What an executive learns on a discovery call, and the system overview and
 * estimate that follow from it.
 *
 * Sits between the audit report and the ScopeManifest. Deliberately NOT a
 * quote: Vega already enforces scope-lock before pricing becomes binding,
 * and an estimate given on a call is an anchor the client will remember. So
 * this carries a range, its assumptions, and an expiry - and it cannot
 * become a Proposal until a scope manifest is signed.
 */

const requirementAnswerSchema = new Schema(
  {
    questionCode: { type: String, required: true, trim: true, maxlength: 60 },
    question: { type: String, required: true, trim: true, maxlength: 400 },
    answer: { type: String, trim: true, maxlength: 2000, default: "" },
    /** Free-form note the executive added while on the call. */
    note: { type: String, trim: true, maxlength: 1000, default: "" },
  },
  { _id: false },
);

const selectedFeatureSchema = new Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 60 },
    label: { type: String, required: true, trim: true, maxlength: 160 },
    priceImpact: { type: Number, required: true, default: 0 },
  },
  { _id: false },
);

const selectedComponentSchema = new Schema(
  {
    componentId: { type: Schema.Types.ObjectId, ref: "PricingComponent", default: null },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 80 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    /** Why this was suggested - shown to the client, so it must be honest. */
    rationale: { type: String, trim: true, maxlength: 500, default: "" },
    /** Recommended by the engine, or added by hand on the call. */
    origin: { type: String, enum: ["recommended", "manual"], default: "recommended" },
    included: { type: Boolean, default: true },
    /**
     * Baseline vs optional, from the PricingPackage this component came from
     * (self-service package flow only). Staff-flow blueprints never set this
     * - "included" is the correct default there too, since that flow has no
     * addon concept.
     */
    packageStatus: { type: String, enum: ["included", "addon"], default: "included" },
    /** Marketing & Sales / Operations / Documentation & Admin / Service & Support - lets the client UI group a long component list into sections instead of one flat list. */
    pillar: {
      type: String,
      enum: ["marketing_sales", "operations", "documentation_admin", "service_support"],
      default: "operations",
    },
    /** Sales / Marketing / Operations / Billing - the self-service results page's own grouping, separate from `pillar` above. */
    department: {
      type: String,
      enum: ["sales", "marketing", "operations", "billing"],
      default: "operations",
    },
    features: { type: [selectedFeatureSchema], default: [] },
    oneTimePrice: { type: Number, required: true, min: 0 },
    monthlyPrice: { type: Number, default: 0, min: 0 },
    deliveryWeeksMin: { type: Number, default: 0 },
    deliveryWeeksMax: { type: Number, default: 0 },
  },
  { _id: false },
);

const blueprintSchema = new Schema(
  {
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    version: { type: Number, required: true, default: 1, min: 1 },
    status: {
      type: String,
      enum: ["draft", "shared", "approved", "rejected", "superseded", "expired"],
      default: "draft",
      required: true,
      index: true,
    },

    /** Snapshot at capture time - the lead's industry can be corrected later. */
    industry: { type: String, trim: true, maxlength: 60 },
    segment: { type: String, trim: true, maxlength: 60 },

    /**
     * Whether an executive filled this in on a call, or a prospect built it
     * themselves through the public questionnaire. Self-service blueprints
     * always start "indicative" confidence and have no preparedBy - nobody
     * on staff has looked at the answers yet.
     */
    origin: { type: String, enum: ["staff_call", "self_service"], default: "staff_call", required: true, index: true },
    scaleTier: {
      type: String,
      enum: ["smb", "midmarket", "enterprise"],
      default: "smb",
      required: true,
    },
    /** The PricingPackage this blueprint was built from (package-based self-service flow only). */
    packageId: { type: Schema.Types.ObjectId, ref: "PricingPackage", default: null },
    /** The chosen launch/growth/scale/enterprise tier key - separate vocabulary from scaleTier above. */
    pricingTierKey: { type: String, trim: true, maxlength: 60, default: null },
    /**
     * The package's own setupPrice/monthlyPrice at capture time - the sheet's
     * precomputed baseline total, kept separate from summing components[]
     * because individual PricingComponent finalPrice values can legitimately
     * drift from the package-level sheet figure. Finalizing adds only the
     * selected addons' own prices on top of this, never resums the baseline.
     */
    packageBaselinePrice: {
      oneTime: { type: Number, default: 0, min: 0 },
      monthly: { type: Number, default: 0, min: 0 },
    },

    answers: { type: [requirementAnswerSchema], default: [] },
    components: { type: [selectedComponentSchema], default: [] },

    /**
     * A range, never a single number. `confidence` reflects how much was
     * actually established on the call, not how sure we feel.
     */
    estimate: {
      oneTimeMin: { type: Number, default: 0, min: 0 },
      oneTimeMax: { type: Number, default: 0, min: 0 },
      monthlyMin: { type: Number, default: 0, min: 0 },
      monthlyMax: { type: Number, default: 0, min: 0 },
      currency: { type: String, enum: ["INR", "USD"], default: "INR" },
      confidence: {
        type: String,
        enum: ["indicative", "informed", "firm"],
        default: "indicative",
      },
      deliveryWeeksMin: { type: Number, default: 0 },
      deliveryWeeksMax: { type: Number, default: 0 },
    },

    /** What the estimate rests on. Printed on the client document verbatim. */
    assumptions: [{ type: String, trim: true, maxlength: 300 }],
    exclusions: [{ type: String, trim: true, maxlength: 300 }],

    /**
     * An estimate without an expiry becomes a promise. Defaults to 30 days.
     */
    validUntil: { type: Date, default: null },

    /** Null for a self-service blueprint - nobody on staff authored it. */
    preparedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    sharedAt: { type: Date, default: null },
    /**
     * Approval is evidence, not a flag - this is what gets pointed at when a
     * price-locked scope is disputed later.
     */
    approvedAt: { type: Date, default: null },
    approvedByName: { type: String, trim: true, maxlength: 160, default: null },
    approvedFromIp: { type: String, trim: true, maxlength: 60, default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, trim: true, maxlength: 1000, default: null },

    /** Set once this blueprint has become a signed scope manifest. */
    scopeManifestId: { type: Schema.Types.ObjectId, ref: "ScopeManifest", default: null },
  },
  { timestamps: true },
);

blueprintSchema.index({ leadId: 1, version: -1 }, { unique: true });
blueprintSchema.index({ status: 1, updatedAt: -1 });

export type BlueprintDocument = InferSchemaType<typeof blueprintSchema>;

const existingBlueprintModel = models.Blueprint;

// In dev HMR, an older cached model can predate the package-flow fields
// (packageId/pricingTierKey/packageBaselinePrice) - same pattern as
// PricingComponent.ts and ActivityLog.ts.
if (
  existingBlueprintModel &&
  (!existingBlueprintModel.schema.path("packageId") ||
    !existingBlueprintModel.schema.path("components.department"))
) {
  delete models.Blueprint;
}

export const BlueprintModel = models.Blueprint || model("Blueprint", blueprintSchema);
