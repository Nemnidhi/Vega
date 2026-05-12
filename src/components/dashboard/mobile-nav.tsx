"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  getDashboardNavItems,
  isDashboardNavItemActive,
} from "@/components/dashboard/nav-items";
import type { UserRole } from "@/types/user";

interface MobileDashboardNavProps {
  role: UserRole;
}

export function MobileDashboardNav({ role }: MobileDashboardNavProps) {
  const pathname = usePathname();
  const navItems = getDashboardNavItems(role);

  return (
    <div className="mb-4 lg:hidden">
      <div className="no-scrollbar flex gap-2 overflow-x-auto rounded-xl border border-white/70 bg-white/90 p-2 shadow-sm">
        {navItems.map((item) => {
          const isActive = isDashboardNavItemActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-semibold transition-all duration-150",
                isActive
                  ? "border-accent/45 bg-accent/14 text-accent-strong"
                  : "border-transparent bg-white text-muted-foreground hover:border-border hover:bg-surface-soft hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
