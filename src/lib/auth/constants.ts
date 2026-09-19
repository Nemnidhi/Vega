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

/** The one sign-in page. Everyone uses it; the account decides where they land. */
export const LOGIN_PATH = "/login";

/** Where a given role lands after signing in. */
export function getHomeRouteForRole(role: string) {
  // Developers used to land on the task list because the only dashboard was a
  // sales one. They have their own now, so everyone but a client starts there.
  if (role === "client") return "/client";
  return "/dashboard";
}

export function getStaffHomeRoute(role: LoginRole) {
  return getHomeRouteForRole(role);
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
