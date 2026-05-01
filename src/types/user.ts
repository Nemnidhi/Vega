import type { BaseDocument, ObjectId } from "@/types/common";

export type UserRole =
  | "admin"
  | "partner"
  | "sales"
  | "project_manager"
  | "developer"
  | "client";

export type UserStatus = "active" | "inactive" | "invited";

export interface User extends BaseDocument {
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  phone?: string;
  department?: string;
  avatarUrl?: string;
  managerId?: ObjectId | null;
  lastLoginAt?: Date | null;
}
