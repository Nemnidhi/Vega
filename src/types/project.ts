import type { BaseDocument, ObjectId } from "@/types/common";

export type ProjectStatus = "planned" | "in_progress" | "on_hold" | "completed";

export type ProjectTaskStatus = "todo" | "in_progress" | "blocked" | "done";

export interface ProjectTask {
  _id: ObjectId;
  title: string;
  description?: string;
  status: ProjectTaskStatus;
  assignedDeveloperId: ObjectId;
  createdBy: ObjectId;
  completedAt?: Date | null;
  completedByDeveloperId?: ObjectId | null;
  completionAlertPending?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Project extends BaseDocument {
  title: string;
  description?: string;
  status: ProjectStatus;
  assignedDeveloperId: ObjectId;
  createdBy: ObjectId;
  tasks: ProjectTask[];
}
