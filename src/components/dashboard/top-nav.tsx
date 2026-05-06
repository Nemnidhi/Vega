"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { getDashboardNavItems } from "@/components/dashboard/nav-items";
import { cn } from "@/lib/utils/cn";
import type { UserRole } from "@/types/user";

interface DashboardTopNavProps {
  role: UserRole;
  userLabel: string;
}

export function DashboardTopNav({ role, userLabel }: DashboardTopNavProps) {
  const pathname = usePathname();
  const navItems = getDashboardNavItems(role);

  return (
    <header className="sticky top-3 z-50 mb-4 rounded-lg border border-border bg-white/95 p-3 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Vega
          </p>
          <p className="truncate text-xs font-semibold text-foreground sm:text-sm">
            {userLabel} | {role.replaceAll("_", " ")}
          </p>
        </div>
        <LogoutButton />
      </div>

      <nav className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "whitespace-nowrap rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                isActive
                  ? "border-accent bg-accent-soft text-accent-strong"
                  : "border-transparent bg-white text-muted-foreground hover:border-border hover:bg-surface-soft hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
