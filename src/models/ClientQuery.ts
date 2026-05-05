import { model, models, Schema, type InferSchemaType } from "mongoose";

const clientQuerySchema = new Schema(
  {
    raisedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    projectName: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
    subject: { type: String, required: true, trim: true, minlength: 3, maxlength: 200 },
    message: { type: String, required: true, trim: true, minlength: 10, maxlength: 5000 },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved"],
      default: "open",
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

clientQuerySchema.index({ raisedBy: 1, createdAt: -1 });

export type ClientQueryDocument = InferSchemaType<typeof clientQuerySchema>;

export const ClientQueryModel = models.ClientQuery || model("ClientQuery", clientQuerySchema);
