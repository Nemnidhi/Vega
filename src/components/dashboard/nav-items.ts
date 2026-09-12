import type { UserRole } from "@/types/user";

// The sidebar groups these under MAIN / TEAM / PRICING / SETTINGS headings, so the group
// travels with the item rather than being re-derived from the label in the sidebar.
export type DashboardNavGroup = "main" | "team" | "pricing" | "settings";

type DashboardNavItem = {
  label: string;
  href: string;
  group: DashboardNavGroup;
  roles: readonly UserRole[];
};

const dashboardNavItems: DashboardNavItem[] = [
  { label: "Dashboard", href: "/dashboard", group: "main", roles: ["admin", "sales", "digital_marketing"] },
  { label: "Chat", href: "/chat", group: "main", roles: ["admin", "developer", "sales", "digital_marketing"] },
  { label: "Leads", href: "/leads", group: "main", roles: ["admin", "sales", "digital_marketing"] },
  { label: "Clients", href: "/clients", group: "main", roles: ["admin", "sales", "digital_marketing"] },
  { label: "Tasks", href: "/tasks", group: "main", roles: ["admin", "partner", "sales", "digital_marketing", "project_manager", "developer"] },
  { label: "Meetings", href: "/meetings", group: "main", roles: ["admin", "partner", "sales", "project_manager"] },
  { label: "Calendar", href: "/calendar", group: "main", roles: ["admin", "sales", "digital_marketing", "developer"] },
  { label: "Attendance", href: "/attendance", group: "main", roles: ["admin", "sales", "digital_marketing", "developer"] },
  { label: "Salary", href: "/salary", group: "team", roles: ["admin", "sales", "digital_marketing", "developer"] },
  { label: "Team", href: "/users", group: "team", roles: ["admin"] },
  { label: "Queries", href: "/queries", group: "team", roles: ["admin", "sales", "digital_marketing", "developer"] },
  { label: "Pricing Catalog", href: "/pricing-components", group: "pricing", roles: ["admin", "partner", "sales", "digital_marketing"] },
  { label: "Pricing Packages", href: "/pricing-packages", group: "pricing", roles: ["admin", "partner", "sales", "digital_marketing"] },
  { label: "Industries", href: "/industries", group: "pricing", roles: ["admin", "partner", "sales", "digital_marketing"] },
  { label: "Pricing Tiers", href: "/pricing-tiers", group: "pricing", roles: ["admin", "partner", "sales", "digital_marketing"] },
  { label: "Account", href: "/account", group: "settings", roles: ["admin", "developer", "sales", "digital_marketing"] },
];

export function getDashboardNavItems(role: UserRole) {
  return dashboardNavItems.filter((item) => item.roles.includes(role));
}

export function getDashboardNavGroup(role: UserRole, group: DashboardNavGroup) {
  return getDashboardNavItems(role).filter((item) => item.group === group);
}

function normalizePath(path: string) {
  const cleanPath = path.split("?")[0]?.split("#")[0] ?? "/";
  if (cleanPath.length > 1 && cleanPath.endsWith("/")) {
    return cleanPath.slice(0, -1);
  }
  return cleanPath;
}

export function isDashboardNavItemActive(pathname: string, href: string) {
  const currentPath = normalizePath(pathname);
  const navPath = normalizePath(href);
  return currentPath === navPath || currentPath.startsWith(`${navPath}/`);
}
