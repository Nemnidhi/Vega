"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { getDashboardNavItems } from "@/components/dashboard/nav-items";
import type { UserRole } from "@/types/user";

interface MobileDashboardNavProps {
  role: UserRole;
}

export function MobileDashboardNav({ role }: MobileDashboardNavProps) {
  const pathname = usePathname();
  const navItems = getDashboardNavItems(role);

  return (
    <div className="mb-4 lg:hidden">
      <div className="no-scrollbar flex gap-2 overflow-x-auto rounded-lg border border-border bg-white p-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "whitespace-nowrap rounded-md border px-3 py-2 text-xs font-semibold transition-colors",
                isActive
                  ? "border-accent bg-accent-soft text-accent-strong"
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
