import type { UserRole } from "@/types/user";

export const AUTH_COOKIE_NAME = "hrms_session";
export const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export const APP_ROLES: UserRole[] = [
  "admin",
  "partner",
  "sales",
  "project_manager",
  "developer",
  "client",
];
