"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { getDashboardNavItems } from "@/components/dashboard/nav-items";
import type { UserRole } from "@/types/user";

interface DashboardSidebarProps {
  role: UserRole;
}

export function DashboardSidebar({ role }: DashboardSidebarProps) {
  const pathname = usePathname();
  const navItems = getDashboardNavItems(role);

  return (
    <aside className="hidden h-screen w-[280px] shrink-0 border-r border-border bg-white p-5 lg:sticky lg:top-0 lg:flex lg:overflow-y-auto">
      <div className="flex min-h-full flex-col">
        <div className="mb-6 rounded-lg border border-border bg-surface-soft p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Vega
          </p>
          <h1 className="mt-2 text-xl font-semibold text-foreground">Command Center</h1>
          <p className="mt-3 inline-flex rounded-md border border-border bg-white px-2.5 py-1 text-[11px] uppercase tracking-wide text-foreground">
            {role.replaceAll("_", " ")}
          </p>
        </div>

        <nav className="space-y-1">
          {navItems.map((item, index) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                  isActive
                    ? "border-accent bg-accent-soft text-accent-strong"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-surface-soft hover:text-foreground",
                )}
              >
                <span>{item.label}</span>
                <span
                  className={cn(
                    "font-mono text-[11px] transition-colors",
                    isActive ? "text-accent-strong" : "text-muted-foreground/70 group-hover:text-foreground",
                  )}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-5">
          <div className="rounded-lg border border-border bg-surface-soft p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Security Grid
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Session auth is live with role-level control and full audit traceability.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
