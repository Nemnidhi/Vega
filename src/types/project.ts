import type { BaseDocument, ObjectId } from "@/types/common";

export type ProjectStatus = "planned" | "in_progress" | "on_hold" | "completed" | "cancelled";

export interface ProjectTeamMember {
  userId: ObjectId;
  role?: string;
  addedAt?: Date;
}

/**
 * A delivery container. Execution work lives in Task documents pointing here via
 * `Task.projectId` - Project itself holds no tasks.
 */
export interface Project extends BaseDocument {
  title: string;
  description?: string;
  code?: string;
  status: ProjectStatus;
  clientId?: ObjectId | null;
  leadId?: ObjectId | null;
  scopeManifestId?: ObjectId | null;
  proposalId?: ObjectId | null;
  projectManagerId?: ObjectId | null;
  team: ProjectTeamMember[];
  startDate?: Date | null;
  targetEndDate?: Date | null;
  completedAt?: Date | null;
  archivedAt?: Date | null;
  createdBy: ObjectId;
}
