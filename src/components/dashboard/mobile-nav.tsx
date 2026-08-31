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
      <div className="no-scrollbar flex gap-2 overflow-x-auto rounded-md border border-vega-border bg-vega-surface-1 p-2">
        {navItems.map((item) => {
          const isActive = isDashboardNavItemActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "whitespace-nowrap rounded-md border px-3 py-2 text-xs font-medium transition-all duration-150",
                isActive
                  ? "border-vega-purple-border bg-vega-purple-soft text-[#c4b5fd]"
                  : "border-vega-border-soft bg-vega-surface-2 text-vega-text-secondary hover:bg-vega-surface-hover hover:text-vega-text",
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
