import type { UserRole } from "@/types/user";

type DashboardNavItem = {
  label: string;
  href: string;
  roles: readonly UserRole[];
};

const dashboardNavItems: DashboardNavItem[] = [
  { label: "Home", href: "/dashboard", roles: ["admin", "sales", "digital_marketing"] },
  { label: "Chat", href: "/chat", roles: ["admin", "developer", "sales", "digital_marketing"] },
  { label: "Leads", href: "/leads", roles: ["admin", "sales", "digital_marketing"] },
  { label: "Queries", href: "/queries", roles: ["admin", "sales", "digital_marketing", "developer"] },
  { label: "Clients", href: "/clients", roles: ["admin", "sales", "digital_marketing"] },
  { label: "Users", href: "/users", roles: ["admin"] },
  { label: "Pricing Catalog", href: "/pricing-components", roles: ["admin", "partner", "sales", "digital_marketing"] },
  { label: "Pricing Packages", href: "/pricing-packages", roles: ["admin", "partner", "sales", "digital_marketing"] },
  { label: "Industries", href: "/industries", roles: ["admin", "partner", "sales", "digital_marketing"] },
  { label: "Pricing Tiers", href: "/pricing-tiers", roles: ["admin", "partner", "sales", "digital_marketing"] },
  { label: "Tasks", href: "/tasks", roles: ["admin", "partner", "sales", "digital_marketing", "project_manager", "developer"] },
  { label: "Meetings", href: "/meetings", roles: ["admin", "partner", "sales", "project_manager"] },
  { label: "Calendar", href: "/calendar", roles: ["admin", "sales", "digital_marketing", "developer"] },
  { label: "Attendance", href: "/attendance", roles: ["admin", "sales", "digital_marketing", "developer"] },
  { label: "Account", href: "/account", roles: ["admin", "developer", "sales", "digital_marketing"] },
];

export function getDashboardNavItems(role: UserRole) {
  return dashboardNavItems.filter((item) => item.roles.includes(role));
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
