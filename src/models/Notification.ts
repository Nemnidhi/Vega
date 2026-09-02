import { model, models, Schema, type InferSchemaType } from "mongoose";

const notificationTypeValues = [
  "subtask_assigned",
  "subtask_reassigned",
  "subtask_ready",
  "dependency_completed",
  "subtask_blocked",
  "due_date_approaching",
  "subtask_overdue",
  "comment_mention",
  "approval_requested",
  "approval_accepted",
  "approval_rejected",
  "workflow_changed",
] as const;

const notificationSchema = new Schema(
  {
    recipientUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    type: { type: String, enum: notificationTypeValues, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    body: { type: String, trim: true, maxlength: 1000, default: "" },
    entityType: { type: String, enum: ["task"], default: "task", required: true, index: true },
    entityId: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    subtaskId: { type: Schema.Types.ObjectId, ref: "Task", default: null, index: true },
    dependencyId: { type: Schema.Types.ObjectId, ref: "TaskDependency", default: null },
    channels: { type: [String], default: ["in_app"] },
    readAt: { type: Date, default: null, index: true },
    dedupeKey: { type: String, trim: true, maxlength: 240, default: "", index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

notificationSchema.index(
  { recipientUserId: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: "string", $gt: "" } } },
);
notificationSchema.index({ recipientUserId: 1, readAt: 1, createdAt: -1 });

export type NotificationDocument = InferSchemaType<typeof notificationSchema>;

export const NotificationModel = models.Notification || model("Notification", notificationSchema);
