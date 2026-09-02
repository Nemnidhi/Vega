import type { UserRole } from "@/types/user";

export const AUTH_COOKIE_NAME = "hrms_session";
export const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
export const LOGIN_ROLES = ["admin", "developer", "sales", "digital_marketing"] as const;
export type LoginRole = (typeof LOGIN_ROLES)[number];

export const STAFF_LOGIN_ROUTES: Record<LoginRole, string> = {
  admin: "/admin",
  developer: "/developer",
  sales: "/sales",
  digital_marketing: "/digital-marketing",
};

export function getStaffLoginRoute(role: LoginRole) {
  return STAFF_LOGIN_ROUTES[role];
}

export function getStaffHomeRoute(role: LoginRole) {
  if (role === "developer") {
    return "/tasks";
  }
  return "/dashboard";
}

export const APP_ROLES: UserRole[] = [
  "admin",
  "partner",
  "sales",
  "digital_marketing",
  "project_manager",
  "developer",
  "client",
];
