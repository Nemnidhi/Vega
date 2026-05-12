import type { UserRole } from "@/types/user";

type DashboardNavItem = {
  label: string;
  href: string;
  roles: readonly UserRole[];
};

const dashboardNavItems: DashboardNavItem[] = [
  { label: "Home", href: "/dashboard", roles: ["admin", "sales"] },
  { label: "Projects", href: "/projects", roles: ["admin", "developer"] },
  { label: "Chat", href: "/chat", roles: ["admin", "developer", "sales"] },
  { label: "Leads", href: "/leads", roles: ["admin", "sales"] },
  { label: "Pipeline", href: "/pipeline", roles: ["admin", "sales"] },
  { label: "Clients", href: "/clients", roles: ["admin", "sales"] },
  { label: "Users", href: "/users", roles: ["admin"] },
  { label: "Calendar", href: "/calendar", roles: ["admin", "sales", "developer"] },
  { label: "Attendance", href: "/attendance", roles: ["admin", "sales", "developer"] },
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
