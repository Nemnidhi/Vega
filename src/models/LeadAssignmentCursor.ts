import { model, models, Schema } from "mongoose";

const schema = new Schema({
  _id: { type: String, required: true },
  sequence: { type: Number, default: 0, required: true },
});

export const LeadAssignmentCursorModel = models.LeadAssignmentCursor || model("LeadAssignmentCursor", schema);
