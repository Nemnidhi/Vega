import { model, models, Schema, type InferSchemaType } from "mongoose";

const importRowIssueSchema = new Schema(
  {
    rowNumber: { type: Number, required: true },
    level: { type: String, enum: ["warning", "error"], required: true },
    field: { type: String, trim: true, maxlength: 120, default: "" },
    message: { type: String, required: true, trim: true, maxlength: 500 },
  },
  { _id: false },
);

const importJobSchema = new Schema(
  {
    parentTaskId: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    fileName: { type: String, required: true, trim: true, maxlength: 260 },
    fileType: { type: String, enum: ["xlsx", "xls", "csv"], required: true, index: true },
    fileHash: { type: String, required: true, trim: true, maxlength: 128, index: true },
    status: {
      type: String,
      enum: ["previewed", "validated", "imported", "failed"],
      default: "previewed",
      required: true,
      index: true,
    },
    headers: { type: [String], default: [] },
    rows: { type: [Schema.Types.Mixed], default: [] },
    mapping: { type: Schema.Types.Mixed, default: {} },
    summary: {
      totalRows: { type: Number, default: 0 },
      validRows: { type: Number, default: 0 },
      warningCount: { type: Number, default: 0 },
      errorCount: { type: Number, default: 0 },
      importedRows: { type: Number, default: 0 },
      failedRows: { type: Number, default: 0 },
    },
    issues: { type: [importRowIssueSchema], default: [] },
    createdSubtaskIds: { type: [Schema.Types.ObjectId], ref: "Task", default: [] },
    createdDependencyIds: { type: [Schema.Types.ObjectId], ref: "TaskDependency", default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    importedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

importJobSchema.index({ parentTaskId: 1, createdAt: -1 });
importJobSchema.index({ parentTaskId: 1, fileHash: 1 });

export type ImportJobDocument = InferSchemaType<typeof importJobSchema>;

export const ImportJobModel = models.ImportJob || model("ImportJob", importJobSchema);
