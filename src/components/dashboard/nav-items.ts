import type { UserRole } from "@/types/user";

type DashboardNavItem = {
  label: string;
  href: string;
  roles: readonly UserRole[];
};

const dashboardNavItems: DashboardNavItem[] = [
  { label: "Overview", href: "/dashboard", roles: ["admin", "sales"] },
  { label: "Projects", href: "/projects", roles: ["admin", "developer"] },
  { label: "Chat", href: "/chat", roles: ["admin", "developer", "sales"] },
  { label: "Leads", href: "/leads", roles: ["admin", "sales"] },
  { label: "Pipeline", href: "/pipeline", roles: ["admin", "sales"] },
  { label: "Clients", href: "/clients", roles: ["admin", "sales"] },
  { label: "Users", href: "/users", roles: ["admin"] },
];

export function getDashboardNavItems(role: UserRole) {
  return dashboardNavItems.filter((item) => item.roles.includes(role));
}
