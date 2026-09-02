import type { UserRole } from "@/types/user";

export const attendanceMemberRoles: UserRole[] = ["developer", "sales", "digital_marketing"];

export const attendanceAdminRoles: UserRole[] = ["admin"];

export const attendanceDashboardRoles: UserRole[] = [
  ...attendanceAdminRoles,
  ...attendanceMemberRoles,
];
