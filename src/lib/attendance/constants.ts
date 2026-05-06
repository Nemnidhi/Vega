import type { UserRole } from "@/types/user";

export const attendanceMemberRoles: UserRole[] = ["developer", "sales"];

export const attendanceAdminRoles: UserRole[] = ["admin"];

export const attendanceDashboardRoles: UserRole[] = [
  ...attendanceAdminRoles,
  ...attendanceMemberRoles,
];
