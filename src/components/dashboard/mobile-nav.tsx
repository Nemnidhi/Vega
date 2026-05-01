"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { dashboardNavItems } from "@/components/dashboard/nav-items";

export function MobileDashboardNav() {
  const pathname = usePathname();

  return (
    <div className="mb-4 lg:hidden">
      <div className="no-scrollbar flex gap-2 overflow-x-auto rounded-2xl border border-border/70 bg-surface/80 p-2 shadow-[0_10px_28px_rgba(11,28,49,0.08)] backdrop-blur">
        {dashboardNavItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition-all",
                isActive
                  ? "bg-[linear-gradient(120deg,#12958d_0%,#1d4ed8_100%)] text-white shadow-[0_8px_18px_rgba(21,139,134,0.35)]"
                  : "bg-white/80 text-muted-foreground hover:bg-white hover:text-foreground",
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
