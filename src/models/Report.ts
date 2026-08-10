import { model, models, Schema, type InferSchemaType } from "mongoose";

// Digital-presence audit reports, ported from the Samvid Lead Engine. Kept as
// its own model rather than embedded in Lead so the PDF binary never loads on
// an ordinary Lead read. Distinct from Vega's proposal PDFs: this is the cold
// outreach artefact, generated before any sales conversation exists.
const reportSchema = new Schema(
  {
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    /** Samvid's old integer `lead_id`. Migration reference only. */
    legacyLeadId: { type: Number, default: null, index: true },
    // NB: a hydrated document gives this back as a Node Buffer, but `.lean()`
    // gives back a BSON Binary - use `Buffer.from(doc.pdf.buffer)` there.
    pdf: { type: Buffer, required: true },
    /** Tier the report copy was written for, at generation time. */
    categoryUsed: { type: String, enum: ["A", "B", "C", "D"], required: true },
    /** Which LLM produced the personalised paragraph, or "fallback". */
    paragraphSource: { type: String, trim: true, maxlength: 60 },
    generatedAt: { type: Date, default: Date.now, required: true },
    sentAt: { type: Date, default: null },
    sentTo: { type: String, trim: true, lowercase: true, maxlength: 180, default: null },
  },
  { timestamps: true },
);

reportSchema.index({ leadId: 1, generatedAt: -1 });

export type ReportDocument = InferSchemaType<typeof reportSchema>;

export const ReportModel = models.Report || model("Report", reportSchema);
